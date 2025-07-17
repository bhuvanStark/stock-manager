// script.js

// Global product list for autosuggestions
let productList = {};

window.onload = function () {
  loadProductList();
  loadTable();
};

// Load productList once
function loadProductList() {
  firebase.database().ref("products").once("value", snapshot => {
    productList = snapshot.val() || {};
  });
}

// Inward stock = Add or update
function inwardStock() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();

  if (!sku || !name || isNaN(qty) || !receiver) {
    alert("Fill all fields correctly.");
    return;
  }

  const ref = firebase.database().ref("products/" + sku);
  ref.once("value", snapshot => {
    const existing = snapshot.val();
    const newQty = existing ? (existing.quantity + qty) : qty;
    ref.set({
      name: name,
      quantity: newQty
    });

    logTransaction("INWARD", sku, name, qty, "-", receiver);
    loadTable();
    clearFields();
  });
}

// Outward stock = Remove from stock
function outwardStock() {
  const search = document.getElementById("search").value.trim().toLowerCase();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();

  if (!search || isNaN(qty) || !takenBy) {
    alert("Fill all fields correctly.");
    return;
  }

  const ref = firebase.database().ref("products");
  ref.once("value", snapshot => {
    const products = snapshot.val();
    for (let sku in products) {
      const product = products[sku];
      if (sku.toLowerCase() === search || product.name.toLowerCase() === search) {
        const newQty = product.quantity - qty;
        if (newQty < 0) {
          alert("Not enough stock.");
          return;
        }

        firebase.database().ref("products/" + sku).update({ quantity: newQty });
        logTransaction("OUTWARD", sku, product.name, qty, takenBy, "-");
        loadTable();
        clearFields();
        return;
      }
    }
    alert("Product not found.");
  });
}

// Log entry in Firebase
function logTransaction(type, sku, name, qty, takenBy, receiver) {
  const timestamp = new Date().toLocaleString();
  firebase.database().ref("logs").push({
    type,
    sku,
    name,
    quantity: qty,
    takenBy,
    receiver,
    timestamp
  });
}

// Load table of current stock
function loadTable() {
  const tbody = document.getElementById("stockTable").getElementsByTagName("tbody")[0];
  tbody.innerHTML = "";

  firebase.database().ref("products").once("value", snapshot => {
    const products = snapshot.val();
    for (let sku in products) {
      const { name, quantity } = products[sku];
      const row = tbody.insertRow();
      row.insertCell(0).innerText = sku;
      row.insertCell(1).innerText = name;
      row.insertCell(2).innerText = quantity;
    }
  });
}

// Clear all inputs
function clearFields() {
  ["sku", "name", "quantity", "receiver", "search", "removeQty", "takenBy"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// Export logs to CSV
function exportCSV() {
  firebase.database().ref("logs").once("value", snapshot => {
    let csv = "Type,SKU,Name,Quantity,Taken By,Receiver,Date-Time\n";
    snapshot.forEach(child => {
      const data = child.val();
      csv += `${data.type},${data.sku},${data.name},${data.quantity},${data.takenBy},${data.receiver},${data.timestamp}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_logs.csv";
    a.click();
  });
}
