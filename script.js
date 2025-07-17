const db = firebase.database();

function addStock() {
  const name = productName.value.trim();
  const sku = sku.value.trim();
  const qty = parseInt(quantity.value);
  const receiver = receiver.value.trim();

  if (!name || !sku || !qty || !receiver) return alert("Fill all fields.");

  db.ref("stock/" + sku).get().then(snap => {
    const currentQty = snap.exists() ? snap.val().quantity : 0;
    db.ref("stock/" + sku).set({
      name, sku, quantity: currentQty + qty
    });

    db.ref("logs").push({
      type: "inward",
      name, sku, quantity: qty, receiver,
      timestamp: new Date().toISOString()
    });

    alert("Stock added.");
  });
}

function removeStock() {
  const query = removeProduct.value.trim();
  const qty = parseInt(removeQuantity.value);
  const takenBy = takenBy.value.trim();

  if (!query || !qty || !takenBy) return alert("Fill all fields.");

  db.ref("stock").once("value", snap => {
    let keyFound = null;
    snap.forEach(child => {
      const item = child.val();
      if (item.sku === query || item.name === query) keyFound = child.key;
    });

    if (!keyFound) return alert("Item not found.");
    const item = snap.val()[keyFound];
    if (item.quantity < qty) return alert("Insufficient stock.");

    db.ref("stock/" + keyFound).update({
      quantity: item.quantity - qty
    });

    db.ref("logs").push({
      type: "outward",
      name: item.name,
      sku: item.sku,
      quantity: qty,
      takenBy,
      timestamp: new Date().toISOString()
    });

    alert("Stock removed.");
  });
}

function searchProducts() {
  const q = searchInput.value.toLowerCase();
  db.ref("stock").once("value", snap => {
    let html = "";
    snap.forEach(child => {
      const item = child.val();
      if (item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)) {
        html += `<div>${item.name} (${item.sku}) - Qty: ${item.quantity}</div>`;
      }
    });
    document.getElementById("searchResults").innerHTML = html || "No match.";
  });
}

function exportToCSV() {
  db.ref("logs").once("value", snap => {
    let csv = "Type,Name,SKU,Quantity,Person,Timestamp\n";
    snap.forEach(child => {
      const log = child.val();
      csv += `${log.type},${log.name},${log.sku},${log.quantity},${log.receiver || log.takenBy},${log.timestamp}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stock_logs.csv";
    a.click();
  });
}
