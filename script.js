// Wait for Firebase Auth to confirm user is logged in
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadProducts(); // Load data if logged in
  }
});

const db = firebase.database();

// Load and display all products
function loadProducts() {
  db.ref("products").on("value", snapshot => {
    const productList = document.getElementById("productList");
    productList.innerHTML = "";

    const data = snapshot.val();
    if (data) {
      // Attach search functionality
      setupSearch(data);

      Object.keys(data).forEach(product => {
        const li = document.createElement("li");
        li.textContent = `${product}: ${data[product]} pcs`;
        productList.appendChild(li);
      });
    } else {
      productList.innerHTML = "<li>No products found</li>";
    }
  });
}

// To Search 
function setupSearch(data) {
  const searchBox = document.getElementById("searchBox");
  const searchResult = document.getElementById("searchResult");

  searchBox.addEventListener("input", () => {
    const query = searchBox.value.trim().toLowerCase();

    if (query === "") {
      searchResult.textContent = "";
      return;
    }

    const matched = Object.keys(data).find(product =>
      product.toLowerCase() === query
    );

    if (matched) {
      searchResult.textContent = `✔️ ${matched}: ${data[matched]} in stock`;
    } else {
      searchResult.textContent = `❌ Product not found`;
    }
  });
}


// Add or update product quantity
function addOrUpdateProduct() {
  const name = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);
  const addedBy = document.getElementById("addedBy").value.trim();
  const status = document.getElementById("add-status");

  status.textContent = "";

  // Validation checks
  if (!name) {
    status.textContent = "❌ Product name cannot be empty.";
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    status.textContent = "❌ Quantity must be a positive number.";
    return;
  }

  if (!addedBy) {
    status.textContent = "❌ Please enter your name (Added by).";
    return;
  }

  const productRef = db.ref(`products/${name}`);

  // Use a transaction to update quantity safely
  productRef.transaction(currentQty => {
    return (currentQty || 0) + qty;
  }, (error, committed, snapshot) => {
    if (error) {
      status.textContent = "⚠️ Error updating product. Try again.";
    } else if (!committed) {
      status.textContent = "❌ Update was not committed.";
    } else {
      const newQty = snapshot.val();
      status.textContent = `✅ Product updated successfully. New quantity: ${newQty}`;

      // Add to logs
      const logEntry = {
        product: name,
        quantityAdded: qty,
        addedBy: addedBy,
        timestamp: new Date().toISOString(),
        action: "added"
      };

      db.ref("logs").push(logEntry);
    }
  });

  // Clear fields
  document.getElementById("productName").value = "";
  document.getElementById("productQty").value = "";
  document.getElementById("addedBy").value = "";
}


// Remove stock and log action
function removeProduct() {
  const name = document.getElementById("removeName").value.trim();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();
  const status = document.getElementById("remove-status");
  status.textContent = "";

  if (!name) {
    status.textContent = "Enter product name.";
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    status.textContent = "Enter a valid quantity to remove.";
    return;
  }

  if (!takenBy) {
    status.textContent = "Please enter who is taking the item.";
    return;
  }

  // Confirm before proceeding
  const confirmRemove = confirm(`Are you sure you want to remove ${qty} of "${name}"?`);
  if (!confirmRemove) return;

  // Proceed with stock deduction and log
  db.ref(`products/${name}`).once("value").then(snapshot => {
    const currentQty = snapshot.val();

    if (currentQty === null) {
      status.textContent = "Product not found.";
    } else if (currentQty < qty) {
      status.textContent = "Not enough stock to remove.";
    } else {
      // Update stock
      db.ref(`products/${name}`).transaction(currentQty => {
  if (currentQty === null || currentQty < qty) {
    status.textContent = "Not enough stock or product not found.";
    return; // abort
  }
  return currentQty - qty;
}, (error, committed, snapshot) => {
  if (error) {
    status.textContent = "Error removing product.";
  } else if (!committed) {
    status.textContent = "Remove failed. Try again.";
  } else {
    // Log the removal
    const logEntry = {
      product: name,
      quantityRemoved: qty,
      takenBy: takenBy,
      timestamp: new Date().toISOString()
    };
    db.ref("logs").push(logEntry);
    status.textContent = `✔️ Removed ${qty} of ${name}`;
  }
});

      // Log the removal
      const logEntry = {
        product: name,
        quantityRemoved: qty,
        takenBy: takenBy,
        timestamp: new Date().toISOString()
      };

      db.ref("logs").push(logEntry);
      status.textContent = "Stock removed and logged.";
    }
  });

  // Clear fields
  document.getElementById("removeName").value = "";
  document.getElementById("removeQty").value = "";
  document.getElementById("takenBy").value = "";
}

// Logout function
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
}

// Export products to CSV
function exportProducts() {
  db.ref("products").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) {
      alert("No product data to export.");
      return;
    }

    let csv = "Product,Quantity\n";
    Object.entries(data).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });

    downloadCSV(csv, "products.csv");
  });
}

// Export logs to CSV
function exportLogs() {
  db.ref("logs").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) {
      alert("No logs to export.");
      return;
    }

    let csv = "Product,Quantity Removed,Taken By,Timestamp\n";
    Object.values(data).forEach(log => {
      csv += `"${log.product}",${log.quantityRemoved},"${log.takenBy}","${log.timestamp}"\n`;
    });

    downloadCSV(csv, "logs.csv");
  });
}

// Helper function to trigger download
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function toggleProducts() {
  const container = document.getElementById("productContainer");
  const btn = document.getElementById("toggleBtn");

  if (container.style.display === "none") {
    container.style.display = "block";
    btn.textContent = "🔼 Hide All Products";
  } else {
    container.style.display = "none";
    btn.textContent = "📦 Show All Products";
  }
}


