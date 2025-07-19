// script.js - FINAL WORKING VERSION
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
      const data = child.val();
      if (data && data.name && typeof data.quantity === 'number') {
        const { name, quantity } = data;
        productMap[sku] = { name, quantity };
        window.stockData[sku] = { name, quantity }; // Update global stock data
        skuList.innerHTML += `<option value="${sku}">`;
        nameList.innerHTML += `<option value="${name}">`;
        outList.innerHTML += `<option value="${sku}">`;
        outList.innerHTML += `<option value="${name}">`;
        outList.innerHTML += `<option value="${sku} (${name})">`;
      }
    });
    
    // Call updateStockDisplay if it exists (from HTML)
    if (typeof updateStockDisplay === 'function') {
      updateStockDisplay();
    }
  }).catch(error => {
    console.error("Error loading product data:", error);
  });
}

// Inward Stock (Add/Update)
function inwardStock() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();
  
  if (!sku || !name || isNaN(qty) || qty <= 0 || !receiver) {
    alert("Please fill all fields correctly.");
    return;
  }
  
  const ref = firebase.database().ref("products/" + sku);
  ref.once("value", snapshot => {
    const existing = snapshot.val();
    const newQty = existing ? (existing.quantity + qty) : qty;
    ref.set({ name, quantity: newQty });
    logTransaction("INWARD", sku, name, qty, "-", receiver);
    alert(`Successfully added ${qty} units of ${name}`);
    loadProductData();
    loadStock();
    clearFields();
  }).catch(error => {
    console.error("Error in inward stock:", error);
    alert("Error adding stock. Please try again.");
  });
}

// Outward Stock (Remove) - FINAL WORKING VERSION
function outwardStock() {
  console.log("outwardStock function called");
  
  const input = document.getElementById("out-sku-or-name").value.trim();
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();
  
  if (!input || isNaN(qty) || qty <= 0 || !person) {
    alert("Please fill all fields correctly.");
    return;
  }
  
  console.log("Searching for:", input);
  
  // Check Firebase connection first
  if (typeof firebase === 'undefined') {
    alert("Firebase is not loaded. Please refresh the page.");
    return;
  }
  
  firebase.database().ref("products").once("value", snapshot => {
    let matchedKey = null;
    let matchedName = null;
    let matchedQuantity = 0;
    let allProducts = [];
    
    console.log("Firebase snapshot received");
    
    snapshot.forEach(child => {
      const sku = child.key;
      const data = child.val();
      
      if (data && data.name && typeof data.quantity === 'number') {
        const { name, quantity } = data;
        allProducts.push({ sku, name, quantity });
        
        // Clean inputs for comparison
        const inputClean = input.toLowerCase().trim();
        const skuClean = sku.toLowerCase().trim();
        const nameClean = name.toLowerCase().trim();
        
        // Multiple matching patterns
        let isMatch = false;
        
        // 1. Exact SKU match
        if (inputClean === skuClean) {
          isMatch = true;
          console.log("Matched by SKU");
        }
        
        // 2. Exact name match
        if (inputClean === nameClean) {
          isMatch = true;
          console.log("Matched by name");
        }
        
        // 3. Format: "SKU (Name)"
        const combinedFormat = `${skuClean} (${nameClean})`;
        if (inputClean === combinedFormat) {
          isMatch = true;
          console.log("Matched by combined format");
        }
        
        // 4. Input starts with SKU
        if (inputClean.startsWith(skuClean)) {
          isMatch = true;
          console.log("Matched by SKU prefix");
        }
        
        // 5. Input contains name
        if (inputClean.includes(nameClean) || nameClean.includes(inputClean)) {
          isMatch = true;
          console.log("Matched by name contains");
        }
        
        if (isMatch && !matchedKey) { // Take first match
          matchedKey = sku;
          matchedName = name;
          matchedQuantity = quantity;
          console.log("Match found:", { sku, name, quantity });
        }
      }
    });
    
    console.log("All products:", allProducts);
    console.log("Match result:", { matchedKey, matchedName, matchedQuantity });
    
    if (!matchedKey) {
      const availableProducts = allProducts.map(p => `${p.sku} - ${p.name} (Qty: ${p.quantity})`).join('\n');
      alert(`Product not found!\n\nInput: "${input}"\n\nAvailable products:\n${availableProducts}`);
      return;
    }
    
    // Check if enough stock available
    if (matchedQuantity < qty) {
      alert(`Not enough stock!\nAvailable: ${matchedQuantity}\nRequested: ${qty}`);
      return;
    }
    
    // Remove stock
    const ref = firebase.database().ref("products/" + matchedKey);
    const newQty = matchedQuantity - qty;
    
    if (newQty <= 0) {
      // Remove product completely if quantity becomes 0
      ref.remove()
        .then(() => {
          console.log("Product removed completely");
          logTransaction("OUTWARD", matchedKey, matchedName, qty, person, "-");
          alert(`Successfully removed ${qty} units of ${matchedName}.\nProduct removed from inventory (quantity reached 0).`);
          loadProductData();
          loadStock();
          clearOutwardFields();
        })
        .catch(error => {
          console.error("Error removing product:", error);
          alert("Error removing product. Please try again.");
        });
    } else {
      // Update quantity
      ref.update({ quantity: newQty })
        .then(() => {
          console.log("Stock updated:", { oldQty: matchedQuantity, newQty });
          logTransaction("OUTWARD", matchedKey, matchedName, qty, person, "-");
          alert(`Successfully removed ${qty} units of ${matchedName}.\nRemaining stock: ${newQty}`);
          loadProductData();
          loadStock();
          clearOutwardFields();
        })
        .catch(error => {
          console.error("Error updating stock:", error);
          alert("Error updating stock. Please try again.");
        });
    }
    
  }).catch(error => {
    console.error("Firebase error:", error);
    alert("Error connecting to database. Please try again.");
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
  
  if (!stockItems) return;
  
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
  firebase.database().ref("logs").push(log).catch(error => {
    console.error("Error logging transaction:", error);
  });
}

// Utility functions
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

// Export CSV function
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
  }).catch(error => {
    console.error("Error exporting CSV:", error);
    alert("Error exporting CSV. Please try again.");
  });
}

// Initialize when page loads
window.addEventListener('load', function() {
  console.log("Page loaded, initializing...");
  
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined') {
    console.error("Firebase not loaded!");
    alert("Firebase not loaded. Please check your internet connection and refresh the page.");
    return;
  }
  
  console.log("Firebase loaded successfully");
  loadProductData();
  loadStock();
});

// Backup initialization if window.onload doesn't work
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded");
  if (typeof firebase !== 'undefined') {
    loadProductData();
    loadStock();
  }
});

// Test function for debugging
function testRemoveButton() {
  console.log("Test function called");
  alert("Remove button is working!");
}
