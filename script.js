// Firebase references
const database = firebase.database();
const stockRef = database.ref("stock");
const logsRef = database.ref("logs");

// Add or update product (Inward Stock)
function inwardStock() {
  const name = document.getElementById("productName").value.trim();
  const sku = document.getElementById("sku").value.trim();
  const quantity = parseInt(document.getElementById("quantity").value);
  const receiver = document.getElementById("receiver").value.trim();
  const timestamp = new Date().toLocaleString();

  if (!name || !sku || isNaN(quantity) || !receiver) {
    alert("Please fill in all fields.");
    return;
  }

  stockRef.child(sku).once("value", (snapshot) => {
    const data = snapshot.val();
    const updatedQty = data ? data.quantity + quantity : quantity;

    stockRef.child(sku).set({
      name,
      sku,
      quantity: updatedQty
    });

    logsRef.push({
      type: "Inward",
      name,
      sku,
      quantity,
      receiver,
      timestamp
    });

    alert("Stock added/updated.");
    document.getElementById("productName").value = "";
    document.getElementById("sku").value = "";
    document.getElementById("quantity").value = "";
    document.getElementById("receiver").value = "";
  });
}

// Remove stock (Outward Stock)
function outwardStock() {
  const identifier = document.getElementById("removeProductName").value.trim();
  const quantity = parseInt(document.getElementById("removeQuantity").value);
  const takenBy = document.getElementById("takenBy").value.trim();
  const timestamp = new Date().toLocaleString();

  if (!identifier || isNaN(quantity) || !takenBy) {
    alert("Please fill in all fields.");
    return;
  }

  // Find product by SKU or name
  stockRef.once("value", (snapshot) => {
    let found = false;
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.sku === identifier || data.name.toLowerCase() === identifier.toLowerCase()) {
        found = true;
        if (data.quantity < quantity) {
          alert("Not enough stock to remove.");
        } else {
          const updatedQty = data.quantity - quantity;
          stockRef.child(data.sku).update({ quantity: updatedQty });

          logsRef.push({
            type: "Outward",
            name: data.name,
            sku: data.sku,
            quantity,
            takenBy,
            timestamp
          });

          alert("Stock removed.");
          document.getElementById("removeProductName").value = "";
          document.getElementById("removeQuantity").value = "";
          document.getElementById("takenBy").value = "";
        }
      }
    });
    if (!found) alert("Product not found.");
  });
}

// Live search
document.getElementById("searchInput").addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if (!query) return;

  stockRef.once("value", (snapshot) => {
    snapshot.forEach((child) => {
      const data = child.val();
      if (
        data.name.toLowerCase().includes(query) ||
        data.sku.toLowerCase().includes(query)
      ) {
        const div = document.createElement("div");
        div.className = "result";
        div.innerText = `Name: ${data.name} | SKU: ${data.sku} | Qty: ${data.quantity}`;
        resultsDiv.appendChild(div);
      }
    });
  });
});

// CSV Export
function exportToCSV() {
  logsRef.once("value", (snapshot) => {
    let csv = "Type,Name,SKU,Quantity,Receiver/Taken By,Timestamp\n";

    snapshot.forEach((child) => {
      const log = child.val();
      const row = [
        log.type,
        log.name,
        log.sku,
        log.quantity,
        log.receiver || log.takenBy || "",
        log.timestamp
      ];
      csv += row.join(",") + "\n";
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
