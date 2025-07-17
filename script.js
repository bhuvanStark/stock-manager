// script.js

const db = firebase.database();
const productsRef = db.ref("products");
const logsRef = db.ref("logs");

// Inward adding/updating
function inwardStock() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();

  if (!sku || !name || !qty || qty <= 0 || !receiver) {
    alert("Please provide valid SKU, name, quantity (>0), and receiver name.");
    return;
  }

  productsRef.child(sku).once("value").then(snap => {
    const data = snap.val();
    const newQty = (data ? data.quantity : 0) + qty;

    productsRef.child(sku).set({ name, quantity: newQty });

    logsRef.push({
      sku, name, quantity: qty,
      action: "Inward",
      by: receiver,
      timestamp: new Date().toLocaleString()
    });

    alert("Stock added/updated ✔️");
    clearInputs();
    loadProducts();
  });
}

// Outward removal
function outwardStock() {
  const searchKey = document.getElementById("searchKey").value.trim().toLowerCase();
  const qty = parseInt(document.getElementById("removeQuantity").value);
  const takenBy = document.getElementById("takenBy").value.trim();

  if (!searchKey || !qty || qty <= 0 || !takenBy) {
    alert("Please provide SKU/name, quantity (>0), and your name.");
    return;
  }

  productsRef.once("value").then(snapshot => {
    let found = null;
    snapshot.forEach(child => {
      const key = child.key;
      const val = child.val();
      if (key.toLowerCase() === searchKey || val.name.toLowerCase() === searchKey) {
        found = { sku: key, name: val.name, quantity: val.quantity };
      }
    });

    if (!found) {
      return alert("No matching product found.");
    }
    if (found.quantity < qty) {
      return alert("Not enough stock.");
    }

    const updatedQty = found.quantity - qty;
    if (updatedQty > 0) productsRef.child(found.sku).update({ quantity: updatedQty });
    else productsRef.child(found.sku).remove();

    logsRef.push({
      sku: found.sku,
      name: found.name,
      quantity: qty,
      action: "Outward",
      by: takenBy,
      timestamp: new Date().toLocaleString()
    });

    alert("Stock removed ✔️");
    clearInputs();
    loadProducts();
  });
}

// Display current stock
function loadProducts() {
  const table = document.getElementById("stockTable");
  table.innerHTML = "";
  productsRef.once("value").then(snapshot => {
    snapshot.forEach(child => {
      const val = child.val();
      const row = document.createElement("tr");
      row.innerHTML = `<td>${child.key}</td><td>${val.name}</td><td>${val.quantity}</td>`;
      table.appendChild(row);
    });
  });
}

// Filter by name/sku
function filterProducts() {
  const term = document.getElementById("searchFilter").value.trim().toLowerCase();
  document.querySelectorAll("#stockTable tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
  });
}

// CSV Export
function exportCSV() {
  logsRef.once("value").then(snapshot => {
    let csv = "SKU,Name,Quantity,Action,By,Timestamp\n";
    snapshot.forEach(child => {
      const l = child.val();
      csv += `${l.sku},${l.name},${l.quantity},${l.action},${l.by},${l.timestamp}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stock_logs.csv";
    a.click();
  });
}

// Clear all input fields
function clearInputs() {
  ["sku","name","quantity","receiver","searchKey","removeQuantity","takenBy","searchFilter"]
    .forEach(id => document.getElementById(id).value = "");
}

// Load on start
window.onload = loadProducts;
