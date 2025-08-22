// script.js - TASKTEL MS DEMO/SERVICE STOCK VERSION
let productMap = {}; // Maps product names to their data

// Load all products into productMap and <datalist> suggestions
function loadProductData() {
  firebase.database().ref("products").once("value", snapshot => {
    productMap = {};
    const nameList = document.getElementById("nameList");
    if (nameList) nameList.innerHTML = "";
    
    let productCount = 0;
    
    snapshot.forEach(child => {
      const productName = child.key; // Product name is now the key
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
      return { quantity: currentData.quantity + qty };
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

// OUTWARD STOCK FUNCTION (Remove)
function outwardStock() {
  const name = document.getElementById("out-name").value.trim();
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();
  const outwardDate = document.getElementById("outward-date").value;
  const dcNo = document.getElementById("out-dc").value.trim();
  const serialNumber = document.getElementById("outward-serial").value.trim();
  const customerDetails = document.getElementById("outward-customer").value.trim();

  if (!name || isNaN(qty) || qty <= 0 || !person || !customerDetails) {
    showAlert("Please fill all fields: Product Name, Quantity, Taken By, and Customer Details.", "error");
    return;
  }

  const ref = firebase.database().ref("products/" + name); // Use name as the key
  ref.transaction(currentData => {
    if (currentData === null) {
      showAlert(`Product "${name}" not found in inventory.`, "error");
      return; // Abort transaction
    }
    if (currentData.quantity < qty) {
      showAlert(`Not enough stock! Available: ${currentData.quantity}, Requested: ${qty}`, "error");
      return; // Abort transaction
    }
    const newQty = currentData.quantity - qty;
    // If quantity becomes 0 or less, remove the product
    return newQty > 0 ? { quantity: newQty } : null;
  }, (error, committed, snapshot) => {
    if (error) {
      showAlert("Error removing stock. Please try again.", "error");
    } else if (committed) {
      const remainingQty = snapshot.val() ? snapshot.val().quantity : 0;
      logTransaction("OUTWARD", name, qty, person, "-", outwardDate, dcNo, serialNumber, customerDetails);
      showAlert(`Successfully removed ${qty} of ${name}. Remaining stock: ${remainingQty}`, "success");
      loadProductData();
      clearOutwardFields();
    }
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

// Initialize when page loads
window.addEventListener('load', function() {
  if (typeof firebase === 'undefined') {
    showAlert("Firebase not loaded. Please check your internet connection.", "error");
    return;
  }
  loadProductData();
});
