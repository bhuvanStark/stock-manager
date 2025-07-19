// script.js - TASKTEL MS COMPLETE VERSION
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
    const deleteList = document.getElementById("deleteList");
    
    if (skuList) skuList.innerHTML = "";
    if (nameList) nameList.innerHTML = "";
    if (outList) outList.innerHTML = "";
    if (deleteList) deleteList.innerHTML = "";
    
    snapshot.forEach(child => {
      const sku = child.key;
      const data = child.val();
      if (data && data.name && typeof data.quantity === 'number') {
        const { name, quantity } = data;
        productMap[sku] = { name, quantity };
        window.stockData[sku] = { name, quantity }; // Update global stock data
        
        if (skuList) skuList.innerHTML += `<option value="${sku}">`;
        if (nameList) nameList.innerHTML += `<option value="${name}">`;
        if (outList) {
          outList.innerHTML += `<option value="${sku}">`;
          outList.innerHTML += `<option value="${name}">`;
          outList.innerHTML += `<option value="${sku} (${name})">`;
        }
        if (deleteList) {
          deleteList.innerHTML += `<option value="${sku}">`;
          deleteList.innerHTML += `<option value="${name}">`;
          deleteList.innerHTML += `<option value="${sku} (${name})">`;
        }
      }
    });
    
    console.log("Product data loaded:", Object.keys(productMap).length, "products");
  }).catch(error => {
    console.error("Error loading product data:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error loading product data. Please refresh the page.", "error");
    }
  });
}

// DELETE PRODUCT FUNCTION
function deleteProduct() {
  const input = document.getElementById("delete-product").value.trim();
  const comment = document.getElementById("delete-comment").value.trim();
  
  if (!input) {
    if (typeof showAlert === 'function') {
      showAlert("Please enter a product SKU or name to delete.", "error");
    } else {
      alert("Please enter a product SKU or name to delete.");
    }
    return;
  }
  
  if (!confirm(`⚠️ Are you sure you want to delete "${input}"?\n\nThis action cannot be undone and will permanently remove the product from inventory.`)) {
    return;
  }
  
  console.log("Searching for product to delete:", input);
  
  firebase.database().ref("products").once("value", snapshot => {
    let matchedKey = null;
    let matchedName = null;
    let matchedQuantity = 0;
    let allProducts = [];
    
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
        
        if (isMatch && !matchedKey) { // Take first match
          matchedKey = sku;
          matchedName = name;
          matchedQuantity = quantity;
          console.log("Match found:", { sku, name, quantity });
        }
      }
    });
    
    if (!matchedKey) {
      const availableProducts = allProducts.map(p => `${p.sku} - ${p.name} (Qty: ${p.quantity})`).join('\n');
      if (typeof showAlert === 'function') {
        showAlert(`Product "${input}" not found!`, "error");
      } else {
        alert(`Product not found!\n\nInput: "${input}"\n\nAvailable products:\n${availableProducts}`);
      }
      return;
    }
    
    // Delete the product
    const ref = firebase.database().ref("products/" + matchedKey);
    ref.remove()
      .then(() => {
        console.log("Product deleted successfully");
        logTransaction("DELETE", matchedKey, matchedName, matchedQuantity, "System", "-", comment, getCurrentDate());
        
        if (typeof showAlert === 'function') {
          showAlert(`Successfully deleted ${matchedName} (${matchedKey}) from inventory.`, "success");
        } else {
          alert(`Successfully deleted ${matchedName} (${matchedKey}) from inventory.`);
        }
        
        // Clear form and reload data
        clearDeleteFields();
        loadProductData();
        loadStock();
      })
      .catch(error => {
        console.error("Error deleting product:", error);
        if (typeof showAlert === 'function') {
          showAlert("Error deleting product. Please try again.", "error");
        } else {
          alert("Error deleting product. Please try again.");
        }
      });
  }).catch(error => {
    console.error("Firebase error:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error connecting to database. Please try again.", "error");
    } else {
      alert("Error connecting to database. Please try again.");
    }
  });
}

// INWARD STOCK FUNCTION (Add/Update)
function inwardStock() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();
  const comment = document.getElementById("inward-comment") ? document.getElementById("inward-comment").value.trim() : "";
  const entryDate = document.getElementById("entry-date") ? document.getElementById("entry-date").value : getCurrentDate();
  
  if (!sku || !name || isNaN(qty) || qty <= 0 || !receiver) {
    if (typeof showAlert === 'function') {
      showAlert("Please fill all required fields correctly.", "error");
    } else {
      alert("Please fill all required fields correctly.");
    }
    return;
  }
  
  const ref = firebase.database().ref("products/" + sku);
  ref.once("value", snapshot => {
    const existing = snapshot.val();
    const newQty = existing ? (existing.quantity + qty) : qty;
    ref.set({ name, quantity: newQty });
    logTransaction("INWARD", sku, name, qty, "-", receiver, comment, entryDate);
    
    if (typeof showAlert === 'function') {
      showAlert(`Successfully added ${qty} units of ${name}. Total stock: ${newQty}`, "success");
    } else {
      alert(`Successfully added ${qty} units of ${name}`);
    }
    
    loadProductData();
    loadStock();
    clearFields();
  }).catch(error => {
    console.error("Error in inward stock:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error adding stock. Please try again.", "error");
    } else {
      alert("Error adding stock. Please try again.");
    }
  });
}

// OUTWARD STOCK FUNCTION (Remove)
function outwardStock() {
  console.log("outwardStock function called");
  
  const input = document.getElementById("out-sku-or-name").value.trim();
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();
  const comment = document.getElementById("outward-comment") ? document.getElementById("outward-comment").value.trim() : "";
  
  if (!input || isNaN(qty) || qty <= 0 || !person) {
    if (typeof showAlert === 'function') {
      showAlert("Please fill all required fields correctly.", "error");
    } else {
      alert("Please fill all required fields correctly.");
    }
    return;
  }
  
  console.log("Searching for:", input);
  
  // Check Firebase connection first
  if (typeof firebase === 'undefined') {
    if (typeof showAlert === 'function') {
      showAlert("Firebase is not loaded. Please refresh the page.", "error");
    } else {
      alert("Firebase is not loaded. Please refresh the page.");
    }
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
      if (typeof showAlert === 'function') {
        showAlert(`Product "${input}" not found!`, "error");
      } else {
        alert(`Product not found!\n\nInput: "${input}"\n\nAvailable products:\n${availableProducts}`);
      }
      return;
    }
    
    // Check if enough stock available
    if (matchedQuantity < qty) {
      if (typeof showAlert === 'function') {
        showAlert(`Not enough stock! Available: ${matchedQuantity}, Requested: ${qty}`, "error");
      } else {
        alert(`Not enough stock!\nAvailable: ${matchedQuantity}\nRequested: ${qty}`);
      }
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
          logTransaction("OUTWARD", matchedKey, matchedName, qty, person, "-", comment, getCurrentDate());
          
          if (typeof showAlert === 'function') {
            showAlert(`Successfully removed ${qty} units of ${matchedName}. Product removed from inventory (quantity reached 0).`, "success");
          } else {
            alert(`Successfully removed ${qty} units of ${matchedName}.\nProduct removed from inventory (quantity reached 0).`);
          }
          
          loadProductData();
          loadStock();
          clearOutwardFields();
        })
        .catch(error => {
          console.error("Error removing product:", error);
          if (typeof showAlert === 'function') {
            showAlert("Error removing product. Please try again.", "error");
          } else {
            alert("Error removing product. Please try again.");
          }
        });
    } else {
      // Update quantity
      ref.update({ quantity: newQty })
        .then(() => {
          console.log("Stock updated:", { oldQty: matchedQuantity, newQty });
          logTransaction("OUTWARD", matchedKey, matchedName, qty, person, "-", comment, getCurrentDate());
          
          if (typeof showAlert === 'function') {
            showAlert(`Successfully removed ${qty} units of ${matchedName}. Remaining stock: ${newQty}`, "success");
          } else {
            alert(`Successfully removed ${qty} units of ${matchedName}.\nRemaining stock: ${newQty}`);
          }
          
          loadProductData();
          loadStock();
          clearOutwardFields();
        })
        .catch(error => {
          console.error("Error updating stock:", error);
          if (typeof showAlert === 'function') {
            showAlert("Error updating stock. Please try again.", "error");
          } else {
            alert("Error updating stock. Please try again.");
          }
        });
    }
    
  }).catch(error => {
    console.error("Firebase error:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error connecting to database. Please try again.", "error");
    } else {
      alert("Error connecting to database. Please try again.");
    }
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

// Load stock (simplified version)
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
    
    console.log("Stock data loaded:", Object.keys(window.stockData).length, "products");
  }).catch(error => {
    console.error("Error loading stock:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error loading stock data. Please try again.", "error");
    }
  });
}

// Log a transaction to Firebase
function logTransaction(type, sku, name, quantity, takenBy, receiver, comment, entryDate) {
  const log = {
    type,
    sku,
    name,
    quantity,
    takenBy: takenBy || "-",
    receiver: receiver || "-",
    comment: comment || "-",
    entryDate: entryDate || getCurrentDate(),
    timestamp: new Date().toLocaleString()
  };
  firebase.database().ref("logs").push(log).catch(error => {
    console.error("Error logging transaction:", error);
  });
}

// Clear inward fields
function clearFields() {
  ["sku", "name", "quantity", "receiver"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  
  // Clear comment and reset date
  const commentEl = document.getElementById("inward-comment");
  if (commentEl) commentEl.value = "";
  
  const dateEl = document.getElementById("entry-date");
  if (dateEl) dateEl.valueAsDate = new Date();
}

// Clear outward fields
function clearOutwardFields() {
  ["out-sku-or-name", "out-qty", "out-person"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  
  // Clear comment
  const commentEl = document.getElementById("outward-comment");
  if (commentEl) commentEl.value = "";
}

// Clear delete fields
function clearDeleteFields() {
  const productEl = document.getElementById("delete-product");
  const commentEl = document.getElementById("delete-comment");
  
  if (productEl) productEl.value = "";
  if (commentEl) commentEl.value = "";
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// Export CSV function
function exportCSV() {
  firebase.database().ref("logs").once("value", snapshot => {
    let csvContent = "Type,SKU,Name,Quantity,Taken By,Receiver,Entry Date,Comments,Timestamp\n";
    snapshot.forEach(child => {
      const log = child.val();
      // Escape commas and quotes in CSV data
      const escapeCSV = (str) => {
        if (str === null || str === undefined) return '"-"';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      
      csvContent += `${escapeCSV(log.type)},${escapeCSV(log.sku)},${escapeCSV(log.name)},${escapeCSV(log.quantity)},${escapeCSV(log.takenBy || "-")},${escapeCSV(log.receiver || "-")},${escapeCSV(log.entryDate || "-")},${escapeCSV(log.comment || "-")},${escapeCSV(log.timestamp)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasktel_ms_logs_${getCurrentDate()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    if (typeof showAlert === 'function') {
      showAlert("CSV file exported successfully!", "success");
    } else {
      alert("CSV file exported successfully!");
    }
  }).catch(error => {
    console.error("Error exporting CSV:", error);
    if (typeof showAlert === 'function') {
      showAlert("Error exporting CSV. Please try again.", "error");
    } else {
      alert("Error exporting CSV. Please try again.");
    }
  });
}

// Initialize when page loads
window.addEventListener('load', function() {
  console.log("Tasktel MS - Page loaded, initializing...");
  
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined') {
    console.error("Firebase not loaded!");
    if (typeof showAlert === 'function') {
      showAlert("Firebase not loaded. Please check your internet connection and refresh the page.", "error");
    } else {
      alert("Firebase not loaded. Please check your internet connection and refresh the page.");
    }
    return;
  }
  
  console.log("Firebase loaded successfully");
  loadProductData();
  loadStock();
});

// Backup initialization if window.onload doesn't work
document.addEventListener('DOMContentLoaded', function() {
  console.log("Tasktel MS - DOM loaded");
  if (typeof firebase !== 'undefined') {
    loadProductData();
    loadStock();
  }
});

// Test function for debugging
function testRemoveButton() {
  console.log("Tasktel MS - Test function called");
  if (typeof showAlert === 'function') {
    showAlert("Remove button is working!", "success");
  } else {
    alert("Remove button is working!");
  }
}
