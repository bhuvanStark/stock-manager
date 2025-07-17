// Firebase v8 config
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function addOrUpdateProduct() {
  const sku = document.getElementById("productSKU").value.trim();
  const name = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);
  const receiver = document.getElementById("receiverName").value.trim();

  if (!sku || !name || isNaN(qty) || qty <= 0) {
    alert("Please enter valid SKU, Name and Quantity.");
    return;
  }

  const productRef = db.ref("products/" + sku);
  productRef.once("value", snapshot => {
    const existing = snapshot.val();
    const updatedQty = existing ? existing.quantity + qty : qty;
    const data = { name: name, quantity: updatedQty };
    productRef.set(data);

    // log it
    const timestamp = new Date().toLocaleString();
    db.ref("logs").push({
      sku,
      name,
      quantity: qty,
      action: "IN",
      person: receiver || "Unknown",
      timestamp
    });

    alert("Stock added/updated.");
    clearInwardFields();
    loadStock();
  });
}

function removeProduct() {
  const input = document.getElementById("removeSKUorName").value.trim();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();

  if (!input || isNaN(qty) || qty <= 0) {
    alert("Please enter valid SKU/Name and Quantity.");
    return;
  }

  db.ref("products").once("value", snapshot => {
    let foundKey = null, foundName = null;
    snapshot.forEach(child => {
      const key = child.key;
      const val = child.val();
      if (key === input || val.name.toLowerCase() === input.toLowerCase()) {
        foundKey = key;
        foundName = val.name;
      }
    });

    if (!foundKey) {
      alert("Product not found.");
      return;
    }

    const prodRef = db.ref("products/" + foundKey);
    prodRef.once("value", snap => {
      const data = snap.val();
      if (data.quantity < qty) {
        alert("Not enough stock.");
        return;
      }
      const newQty = data.quantity - qty;
      if (newQty === 0) prodRef.remove();
      else prodRef.update({ quantity: newQty });

      // log
      const timestamp = new Date().toLocaleString();
      db.ref("logs").push({
        sku: foundKey,
        name: foundName,
        quantity: qty,
        action: "OUT",
        person: takenBy || "Unknown",
        timestamp
      });

      alert("Stock removed.");
      clearOutwardFields();
      loadStock();
    });
  });
}

function loadStock() {
  const body = document.getElementById("stockTableBody");
  body.innerHTML = "";
  db.ref("products").once("value", snapshot => {
    snapshot.forEach(child => {
      const sku = child.key;
      const { name, quantity } = child.val();
      const row = document.createElement("tr");
      row.innerHTML = `<td>${sku}</td><td>${name}</td><td>${quantity}</td>`;
      body.appendChild(row);
    });
  });
}

function exportToCSV() {
  db.ref("logs").once("value", snapshot => {
    let csv = "SKU,Product Name,Quantity,Action,Person,Date-Time\n";
    snapshot.forEach(child => {
      const { sku, name, quantity, action, person, timestamp } = child.val();
      csv += `${sku},${name},${quantity},${action},${person},${timestamp}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_logs.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  });
}

function loadLogs() {
  const logsBody = document.getElementById("logsBody");
  if (!logsBody) return;
  logsBody.innerHTML = "";
  db.ref("logs").once("value", snapshot => {
    snapshot.forEach(child => {
      const { sku, name, quantity, action, person, timestamp } = child.val();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${sku}</td>
        <td>${name}</td>
        <td>${quantity}</td>
        <td>${action}</td>
        <td>${person}</td>
        <td>${timestamp}</td>
      `;
      logsBody.appendChild(row);
    });
  });
}

function filterTable() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const rows = document.querySelectorAll("#stockTableBody tr");
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(input) ? "" : "none";
  });
}

function clearInwardFields() {
  document.getElementById("productSKU").value = "";
  document.getElementById("productName").value = "";
  document.getElementById("productQty").value = "";
  document.getElementById("receiverName").value = "";
}

function clearOutwardFields() {
  document.getElementById("removeSKUorName").value = "";
  document.getElementById("removeQty").value = "";
  document.getElementById("takenBy").value = "";
}

// auto-load stock when index page is opened
window.onload = loadStock;
