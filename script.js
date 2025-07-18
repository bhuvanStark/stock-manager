// script.js

// Global product list for autosuggestions
let productMap = {}; 
let productList = {};


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
  const input = document.getElementById("out-sku-or-name").value.trim();
  const qty = parseInt(document.getElementById("out-qty").value);
  const person = document.getElementById("out-person").value.trim();

  if (!input || isNaN(qty) || qty <= 0 || !person) {
    alert("Please enter valid SKU/Name, quantity, and taken by name.");
    return;
  }

  // Fetch all products and try to match SKU or Name
  firebase.database().ref("products").once("value")
    .then(snapshot => {
      let matchedKey = null;
      let matchedName = null;
      snapshot.forEach(child => {
        const key = child.key;
        const val = child.val();
        if (key === input || val.name.toLowerCase() === input.toLowerCase()) {
          matchedKey = key;
          matchedName = val.name;
        }
      });

      if (!matchedKey) {
        alert("❌ Product not found.");
        return;
      }

      const prodRef = firebase.database().ref("products/" + matchedKey);
      prodRef.once("value").then(snap => {
        const data = snap.val();
        if (!data || data.quantity < qty) {
          alert("❌ Not enough stock to remove.");
          return;
        }

        const newQty = data.quantity - qty;
        if (newQty <= 0) {
          prodRef.remove();
        } else {
          prodRef.update({ quantity: newQty });
        }

        // Log removal
        const log = {
          sku: matchedKey,
          name: matchedName,
          quantity: qty,
          action: "OUT",
          person,
          timestamp: new Date().toLocaleString()
        };

        firebase.database().ref("logs").push(log);

        alert("✔️ Stock removed successfully.");
        loadStock();
        clearOutwardFields();
      });
    });
}

function clearOutwardFields() {
  document.getElementById("out-sku-or-name").value = "";
  document.getElementById("out-qty").value = "";
  document.getElementById("out-person").value = "";
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

function loadProductSuggestions() {
  firebase.database().ref("products").once("value").then(snapshot => {
    const skuList = document.getElementById("skuList");
    const nameList = document.getElementById("nameList");
    const outList = document.getElementById("outList");

    skuList.innerHTML = "";
    nameList.innerHTML = "";
    outList.innerHTML = "";
    productMap = {};

    snapshot.forEach(child => {
      const sku = child.key;
      const { name, quantity } = child.val();
      productMap[sku] = { name, quantity };

      const opt1 = document.createElement("option");
      opt1.value = sku;
      skuList.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = name;
      nameList.appendChild(opt2);

      const opt3 = document.createElement("option");
      opt3.value = `${sku} (${name})`;
      outList.appendChild(opt3);
    });
  });
}

function syncSKUName(changedField) {
  const skuInput = document.getElementById("sku");
  const nameInput = document.getElementById("name");

  if (changedField === "sku") {
    const sku = skuInput.value.trim();
    if (productMap[sku]) {
      nameInput.value = productMap[sku].name;
    }
  } else if (changedField === "name") {
    const name = nameInput.value.trim().toLowerCase();
    for (const [sku, obj] of Object.entries(productMap)) {
      if (obj.name.toLowerCase() === name) {
        skuInput.value = sku;
        break;
      }
    }
  }
}

function loadStock() {
  const body = document.getElementById("stockTableBody");
  body.innerHTML = "";
  firebase.database().ref("products").once("value", snapshot => {
    snapshot.forEach(child => {
      const sku = child.key;
      const { name, quantity } = child.val();
      const row = document.createElement("tr");
      row.innerHTML = `<td>${sku}</td><td>${name}</td><td>${quantity}</td>`;
      body.appendChild(row);
    });
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

window.onload = function () {
  loadProductList();
  loadTable();
  loadStock();
  loadProductSuggestions();
};
