// script.js

const db = firebase.database();
const productsRef = db.ref("products");
const logsRef = db.ref("logs");

function addOrUpdateProduct() {
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const qty = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();

  if (!sku || !name || isNaN(qty) || qty <= 0 || !receiver) {
    alert("Please fill all fields correctly.");
    return;
  }

  const productRef = productsRef.child(sku);
  productRef.once("value").then(snapshot => {
    const existing = snapshot.val();
    const newQty = existing ? existing.quantity + qty : qty;

    productRef.set({ name, quantity: newQty });

    const timestamp = new Date().toLocaleString();
    logsRef.push({
      sku,
      name,
      quantity: qty,
      type: "Inward",
      by: "System",
      receiver,
      timestamp
    });

    alert("Stock added/updated!");
    clearInputs();
    loadProducts();
  });
}

function removeProduct() {
  const search = document.getElementById("search").value.trim().toLowerCase();
  const qty = parseInt(document.getElementById("removeQuantity").value);
  const takenBy = document.getElementById("takenBy").value.trim();

  if (!search || isNaN(qty) || qty <= 0 || !takenBy) {
    alert("Please fill all fields correctly.");
    return;
  }

  productsRef.once("value", snapshot => {
    let found = false;
    snapshot.forEach(child => {
      const key = child.key;
      const data = child.val();
      if (key.toLowerCase() === search || data.name.toLowerCase() === search) {
        found = true;
        const newQty = data.quantity - qty;
        if (newQty < 0) {
          alert("Not enough stock.");
        } else {
          const timestamp = new Date().toLocaleString();
          productsRef.child(key).update({ quantity: newQty });
          logsRef.push({
            sku: key,
            name: data.name,
            quantity: qty,
            type: "Outward",
            by: takenBy,
            receiver: "",
            timestamp
          });
          alert("Stock removed.");
          clearInputs();
          loadProducts();
        }
      }
    });
    if (!found) alert("Product not found.");
  });
}

function loadProducts() {
  const tbody = document.getElementById("productTableBody");
  tbody.innerHTML = "";
  productsRef.once("value", snapshot => {
    snapshot.forEach(child => {
      const key = child.key;
      const data = child.val();
      const row = `<tr>
        <td>${key}</td>
        <td>${data.name}</td>
        <td>${data.quantity}</td>
      </tr>`;
      tbody.innerHTML += row;
    });
  });
}

function clearInputs() {
  ["sku", "name", "quantity", "receiver", "search", "removeQuantity", "takenBy"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

// CSV Export
function exportCSV() {
  logsRef.once("value", snapshot => {
    let csv = "SKU,Name,Quantity,Taken By,Receiver,Type,Timestamp\n";
    snapshot.forEach(child => {
      const log = child.val();
      csv += `${log.sku},${log.name},${log.quantity},${log.by},${log.receiver},${log.type},${log.timestamp}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}

window.onload = loadProducts;
