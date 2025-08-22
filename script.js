// script.js - TASKTEL MS DEMO/SERVICE STOCK VERSION (v3.2 - Robust Matching Fix)
let productMap = {}; // Maps product names to their data

// Load all products into productMap and <datalist> suggestions
function loadProductData() {
  firebase.database().ref("products").once("value", snapshot => {
    productMap = {};
    const nameList = document.getElementById("nameList");
    if (nameList) nameList.innerHTML = "";
    
    let productCount = 0;
    
    snapshot.forEach(child => {
      const productName = child.key; // Product name is the key
      const data = child.val();
      if (data && typeof data.quantity === 'number') {
        productMap[productName] = { quantity: data.quantity };
        productCount++;
        
        const escapedName = productName.replace(/"/g, "&quot;");
        if (nameList) {
          nameList.innerHTML += `<option value="${escapedName}"></option>`;
        }
      }
    });
    
    console.log("Product data loaded:", productCount, "products");
  }).catch(error => {
    console.error("Error loading product data:", error);
    showAlert("Error loading product data. Please refresh.", "error");
  });
}

// INWARD STOCK FUNCTION (Add/Update)
function inwardStock() {
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();
  const entryDate = document.getElementById("entry-date").value;
  const serialNumber = document.getElementById("inward-serial").value.trim();
  const customerDetails = document.getElementById("inward-customer").value.trim();

  if (!name || isNaN(qty) || qty <= 0 || !receiver) {
    showAlert("Please fill Product Name, Quantity, and Received By fields.", "error");
    return;
  }

  const ref = firebase.database().ref("products/" + name); // Use name as the key
  ref.transaction(currentData => {
    if (currentData === null) {
      return { quantity: qty };
    } else {
      return { quantity: (currentData.quantity || 0) + qty };
    }
  }, (error, committed, snapshot) => {
    if (error) {
      showAlert("Error adding stock. Please try again.", "error");
    } else if (committed) {
      const newTotal = snapshot.val().quantity;
      logTransaction("INWARD", name, qty, "-", receiver, entryDate, "-", serialNumber, customerDetails);
      showAlert(`Successfully added ${qty} units of ${name}. Total stock: ${newTotal}`, "success");
      loadProductData();
      clearFields();
    }
  });
}

// OUTWARD STOCK FUNCTION (Remove) - REWRITTEN FOR RELIABILITY
function outwardStock() {
  const nameInput = document.getElementById("out-name").value;
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();
  const outwardDate = document.getElementById("outward-date").value;
  const dcNo = document.getElementById("out-dc").value.trim();
  const serialNumber = document.getElementById("outward-serial").value.trim();
  const customerDetails = document.getElementById("outward-customer").value.trim();

  if (!nameInput || isNaN(qty) || qty <= 0 || !person || !customerDetails) {
    showAlert("Please fill all required fields: Product Name, Quantity, Taken By, and Customer Details.", "error");
    return;
  }

  // First, find the exact key of the product, ignoring case and trimming whitespace for user-friendliness.
  firebase.database().ref("products").once("value", snapshot => {
    let matchedKey = null;
    const cleanedNameInput = nameInput.trim().toLowerCase(); // Clean the input once

    snapshot.forEach(child => {
      const cleanedKey = child.key.trim().toLowerCase(); // Clean the database key for comparison
      if (cleanedKey === cleanedNameInput) {
        matchedKey = child.key; // Store the original, correctly-cased key
      }
    });

    if (!matchedKey) {
      showAlert(`Product "${nameInput}" not found in inventory. Please select a valid product from the list.`, "error");
      console.log(`Failed match. Input was: "${cleanedNameInput}". Checked against database keys.`);
      return;
    }

    // Now, perform the atomic transaction using the correct key.
    const ref = firebase.database().ref("products/" + matchedKey);
    ref.transaction(currentData => {
      if (currentData === null) {
        return 0; // Abort: Product was deleted by another user.
      }
      if (currentData.quantity < qty) {
        return; // Abort: Not enough stock. Return undefined.
      }
      const newQty = currentData.quantity - qty;
      return newQty > 0 ? { quantity: newQty } : null; // Return new value or null to delete the product node.
    }, (error, committed, snapshot) => {
      if (error) {
        showAlert("A database error occurred. Please try again.", "error");
        console.error("Transaction failed: ", error);
      } else if (!committed) {
        ref.once("value", currentSnapshot => {
            const currentQty = currentSnapshot.exists() ? currentSnapshot.val().quantity : 0;
            if (currentQty < qty) {
                showAlert(`Transaction failed: Not enough stock for ${matchedKey}. Available: ${currentQty}, Requested: ${qty}`, "error");
            } else {
                showAlert(`Transaction failed. The product might have been modified. Please try again.`, "error");
            }
        });
      } else {
        const remainingQty = snapshot.exists() ? snapshot.val().quantity : 0;
        logTransaction("OUTWARD", matchedKey, qty, person, "-", outwardDate, dcNo, serialNumber, customerDetails);
        showAlert(`Successfully removed ${qty} of ${matchedKey}. Remaining stock: ${remainingQty}`, "success");
        loadProductData();
        clearOutwardFields();
      }
    });
  }).catch(err => {
      showAlert("Could not connect to the database to verify product.", "error");
      console.error(err);
  });
}


// DELETE PRODUCT FUNCTION
function deleteProduct() {
    const name = document.getElementById("delete-product").value.trim();
    const reason = document.getElementById("delete-comment").value.trim();

    if (!name) {
        showAlert("Please enter a product name to delete.", "error");
        return;
    }

    if (!confirm(`⚠️ Are you sure you want to delete "${name}"? This is permanent.`)) {
        return;
    }

    const ref = firebase.database().ref("products/" + name);
    ref.once("value", snapshot => {
        if (!snapshot.exists()) {
            showAlert(`Product "${name}" not found.`, "error");
            return;
        }
        
        const originalQty = snapshot.val().quantity || 0;

        ref.remove().then(() => {
            logTransaction("DELETE", name, originalQty, "System", "-", getCurrentDate(), "-", "N/A", reason);
            showAlert(`Successfully deleted ${name} from inventory.`, "success");
            loadProductData();
            document.getElementById("delete-product").value = "";
            document.getElementById("delete-comment").value = "";
        }).catch(error => {
            showAlert("Error deleting product.", "error");
            console.error("Delete error:", error);
        });
    });
}

// Log a transaction to Firebase
function logTransaction(type, name, quantity, takenBy, receiver, date, dcNo, serialNumber, customerDetails) {
  const log = {
    type,
    name,
    quantity,
    person: type === 'INWARD' ? receiver : takenBy,
    date,
    dcNo: dcNo || "-",
    serialNumber: serialNumber || "-",
    customerDetails: customerDetails || "-",
    timestamp: new Date().toLocaleString()
  };
  firebase.database().ref("logs").push(log);
}

// Clear inward fields
function clearFields() {
  document.getElementById("name").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("receiver").value = "";
  document.getElementById("inward-serial").value = "";
  document.getElementById("inward-customer").value = "";
  document.getElementById('entry-date').valueAsDate = new Date();
}

// Clear outward fields
function clearOutwardFields() {
  document.getElementById("out-name").value = "";
  document.getElementById("out-qty").value = "";
  document.getElementById("out-person").value = "";
  document.getElementById("out-dc").value = "";
  document.getElementById("outward-serial").value = "";
  document.getElementById("outward-customer").value = "";
  document.getElementById('outward-date').valueAsDate = new Date();
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// Export CSV function
function exportCSV() {
  firebase.database().ref("logs").once("value", snapshot => {
    let csvContent = "Type,Product Name,Quantity,Person,Date,DC No,Serial Number,Customer Details,Timestamp\n";
    snapshot.forEach(child => {
      const log = child.val();
      const escapeCSV = (str) => {
        if (str === null || str === undefined) return '""';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      
      csvContent += `${escapeCSV(log.type)},${escapeCSV(log.name)},${escapeCSV(log.quantity)},${escapeCSV(log.person)},${escapeCSV(log.date)},${escapeCSV(log.dcNo)},${escapeCSV(log.serialNumber)},${escapeCSV(log.customerDetails)},${escapeCSV(log.timestamp)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasktel_ms_logs_${getCurrentDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert("CSV file exported successfully!", "success");
  }).catch(error => {
    showAlert("Error exporting CSV.", "error");
  });
}

// A simple alert function to replace the native one
function showAlert(message, type = 'success') {
    console.log(`Alert (${type}): ${message}`);
    alert(message);
}

// Initialize when page loads
window.addEventListener('load', function() {
  if (typeof firebase === 'undefined') {
    showAlert("Firebase not loaded. Please check your internet connection.", "error");
    return;
  }
  loadProductData();
});
