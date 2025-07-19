// script.js
let productMap = {}; // For syncing and suggestions
window.stockData = {}; // Global stock data for dropdown

// Load all products into productMap and <datalist> suggestions
function loadProductData() {
  firebase.database().ref("products").once("value", snapshot => {
    productMap = {};
    window.stockData = {}; // Update global stock data
    const skuList = document.getElementById("skuList");
    const nameList = document.getElementById("nameList");
    const outList = document.getElementById("outList");
    skuList.innerHTML = "";
    nameList.innerHTML = "";
    outList.innerHTML = "";
    snapshot.forEach(child => {
      const sku = child.key;
      const { name, quantity } = child.val();
      productMap[sku] = { name, quantity };
      window.stockData[sku] = { name, quantity }; // Update global stock data
      skuList.innerHTML += `<option value="${sku}">`;
      nameList.innerHTML += `<option value="${name}">`;
      outList.innerHTML += `<option value="${sku} (${name})">`;
    });
    // Call updateStockDisplay if it exists (from HTML)
    if (typeof updateStockDisplay === 'function') {
      updateStockDisplay();
    }
  });
}

// Inward Stock (Add/Update)
function inwardStock() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();
  if (!sku || !name || isNaN(qty) || !receiver) {
    alert("Please fill all fields correctly.");
    return;
  }
  const ref = firebase.database().ref("products/" + sku);
  ref.once("value", snapshot => {
    const existing = snapshot.val();
    const newQty = existing ? (existing.quantity + qty) : qty;
    ref.set({ name, quantity: newQty });
    logTransaction("INWARD", sku, name, qty, "-", receiver);
    loadStock();
    clearFields();
  });
}

// Outward Stock (Remove) - DEBUG VERSION
function outwardStock() {
  const input = document.getElementById("out-sku-or-name").value.trim();
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();
  
  if (!input || isNaN(qty) || qty <= 0 || !person) {
    alert("Please fill all fields.");
    return;
  }
  
  // Debug: Log what we're searching for
  console.log("Searching for:", input);
  
  firebase.database().ref("products").once("value", snapshot => {
    let matchedKey = null;
    let matchedName = null;
    let allProducts = []; // For debugging
    
    snapshot.forEach(child => {
      const sku = child.key;
      const data = child.val();
      
      // Debug: Log each product we're checking
      console.log("Checking product:", sku, data);
      
      // Enhanced data validation
      if (data && 
          typeof data === 'object' && 
          data.name && 
          typeof data.name === 'string' && 
          data.name.trim() !== '' && 
          typeof data.quantity === 'number') {
        
        const { name, quantity } = data;
        allProducts.push({ sku, name, quantity }); // For debugging
        
        // Additional safety check before toLowerCase()
        if (name && typeof name === 'string') {
          const inputLower = input.toLowerCase().trim();
          const nameLower = name.toLowerCase().trim();
          const skuLower = sku.toLowerCase().trim();
          
          // Debug: Log the comparison
          console.log("Comparing:", {
            input: inputLower,
            sku: skuLower,
            name: nameLower,
            skuMatch: skuLower === inputLower,
            nameMatch: nameLower === inputLower
          });
          
          // More flexible matching
          if (skuLower === inputLower || nameLower === inputLower) {
            matchedKey = sku;
            matchedName = name;
            console.log("MATCH FOUND:", { sku, name });
          }
        }
      } else {
        console.log("Invalid data for SKU:", sku, data);
      }
    });
    
    // Debug: Show all available products
    console.log("All available products:", allProducts);
    console.log("Matched product:", { matchedKey, matchedName });
    
    if (!matchedKey) {
      alert(`Product not found. Available products: ${allProducts.map(p => `${p.sku} (${p.name})`).join(', ')}`);
      return;
    }
    
    const ref = firebase.database().ref("products/" + matchedKey);
    ref.once("value", snap => {
      const data = snap.val();
      if (!data || typeof data.quantity !== 'number') {
        alert("Product data error.");
        return;
      }
      if (data.quantity < qty) {
        alert(`Not enough stock. Available: ${data.quantity}, Requested: ${qty}`);
        return;
      }
      const newQty = data.quantity - qty;
      if (newQty <= 0) {
        ref.remove();
      } else {
        ref.update({ quantity: newQty });
      }
      logTransaction("OUTWARD", matchedKey, matchedName, qty, person, "-");
      loadStock();
      clearOutwardFields();
    }).catch(error => {
      console.error("Error updating stock:", error);
      alert("Error updating stock. Please try again.");
    });
  }).catch(error => {
    console.error("Error in outward stock:", error);
    alert("Error processing outward stock. Please try again.");
  });
}
// Sync SKU ↔ Name when user types one of them
function syncSKUName(field) {
  const skuInput = document.getElementById("sku");
  const nameInput = document.getElementById("name");
  
  if (!skuInput || !nameInput) return; // Safety check
  
  if (field === "sku") {
    const sku = skuInput.value.trim();
    if (productMap[sku] && productMap[sku].name) {
      nameInput.value = productMap[sku].name;
    }
  } else if (field === "name") {
    const name = nameInput.value.trim();
    if (!name) return; // Don't process empty names
    
    const nameLower = name.toLowerCase();
    for (const sku in productMap) {
      if (productMap[sku] && productMap[sku].name && 
          productMap[sku].name.toLowerCase() === nameLower) {
        skuInput.value = sku;
        break;
      }
    }
  }
}

// Load stock dropdown (replaces loadStock table function)
function loadStock() {
  firebase.database().ref("products").once("value", snapshot => {
    window.stockData = {}; // Reset global stock data
    snapshot.forEach(child => {
      const sku = child.key;
      const data = child.val();
      if (data && data.name && typeof data.quantity === 'number') {
        const { name, quantity } = data;
        window.stockData[sku] = { name, quantity };
      }
    });
    // Call updateStockDisplay if it exists (from HTML)
    if (typeof updateStockDisplay === 'function') {
      updateStockDisplay();
    }
  }).catch(error => {
    console.error("Error loading stock:", error);
  });
}

// Update stock dropdown display
function updateStockDisplay() {
  const stockItems = document.getElementById('stockItems');
  
  if (!window.stockData || Object.keys(window.stockData).length === 0) {
    stockItems.innerHTML = '<div class="empty-state">No stock items available</div>';
    return;
  }
  
  let itemsHTML = '';
  for (const [sku, data] of Object.entries(window.stockData)) {
    if (data.quantity > 0) {
      itemsHTML += `
        <div class="dropdown-item fade-in">
          <div class="stock-info">
            <div>
              <div class="stock-name">${data.name}</div>
              <div class="stock-sku">SKU: ${sku}</div>
            </div>
            <div class="stock-quantity">${data.quantity}</div>
          </div>
        </div>
      `;
    }
  }
  
  stockItems.innerHTML = itemsHTML || '<div class="empty-state">No stock items available</div>';
}

// Log a transaction to Firebase
function logTransaction(type, sku, name, quantity, takenBy, receiver) {
  const log = {
    type,
    sku,
    name,
    quantity,
    takenBy,
    receiver,
    timestamp: new Date().toLocaleString()
  };
  firebase.database().ref("logs").push(log);
}

// Utility
function clearFields() {
  ["sku", "name", "quantity", "receiver"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function clearOutwardFields() {
  ["out-sku-or-name", "out-qty", "out-person"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// Export CSV function (keeping your existing functionality)
function exportCSV() {
  firebase.database().ref("logs").once("value", snapshot => {
    let csvContent = "Type,SKU,Name,Quantity,Taken By,Receiver,Timestamp\n";
    snapshot.forEach(child => {
      const log = child.val();
      csvContent += `${log.type},${log.sku},${log.name},${log.quantity},${log.takenBy},${log.receiver},${log.timestamp}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_logs.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  });
}

// On page load
window.onload = () => {
  loadProductData();
  loadStock();
};
