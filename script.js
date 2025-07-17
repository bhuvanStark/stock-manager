firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadProducts();
  }
});

let allProducts = {};

function loadProducts() {
  firebase.database().ref("products").on("value", snapshot => {
    const productList = document.getElementById("productList");
    if (productList) productList.innerHTML = "";

    const data = snapshot.val();
    if (!data) return;

    allProducts = data;

    Object.entries(data).forEach(([key, value]) => {
      if (productList) {
        const li = document.createElement("li");
        li.textContent = `${value.name} (${key}) : ${value.quantity} pcs`;
        productList.appendChild(li);
      }
    });

    setupAutocomplete("productName");
    setupAutocomplete("removeName");
    setupSearch(data);
  });
}

function setupSearch(data) {
  const searchBox = document.getElementById("searchBox");
  const result = document.getElementById("searchResult");

  if (!searchBox) return;

  searchBox.addEventListener("input", () => {
    const query = searchBox.value.trim().toLowerCase();
    if (!query) {
      result.textContent = "";
      return;
    }

    const matches = Object.entries(data).filter(([sku, p]) =>
      sku.toLowerCase().startsWith(query) || p.name.toLowerCase().startsWith(query)
    );

    if (matches.length === 0) {
      result.textContent = "❌ Product not found";
    } else {
      result.textContent = matches
        .map(([sku, p]) => `✔️ ${p.name} (${sku}): ${p.quantity} in stock`)
        .join("\n");
    }
  });
}

function setupAutocomplete(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener("input", () => {
    const list = document.getElementById(id + "-list");
    if (!list) return;

    const query = input.value.toLowerCase();
    list.innerHTML = "";

    Object.entries(allProducts).forEach(([sku, p]) => {
      if (sku.toLowerCase().startsWith(query) || p.name.toLowerCase().startsWith(query)) {
        const option = document.createElement("option");
        option.value = `${p.name} (${sku})`;
        list.appendChild(option);
      }
    });
  });
}

function inwardStock() {
  const nameField = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);
  const addedBy = document.getElementById("addedBy").value.trim();
  const status = document.getElementById("add-status");

  status.textContent = "";

  if (!nameField || isNaN(qty) || qty <= 0 || !addedBy) {
    status.textContent = "❌ All fields required, quantity must be > 0";
    return;
  }

  const sku = extractSKU(nameField);
  const name = extractName(nameField);

  const ref = firebase.database().ref("products/" + sku);

  ref.transaction(current => {
    if (current) {
      return {
        ...current,
        quantity: (current.quantity || 0) + qty
      };
    } else {
      return {
        name,
        quantity: qty
      };
    }
  }, (error, committed, snapshot) => {
    if (error || !committed) {
      status.textContent = "⚠️ Failed to add stock";
    } else {
      firebase.database().ref("logs").push({
        sku,
        name,
        quantityAdded: qty,
        addedBy,
        timestamp: new Date().toISOString(),
        action: "inward"
      });
      status.textContent = `✅ Stock updated. New: ${snapshot.val().quantity}`;
    }
  });

  document.getElementById("productName").value = "";
  document.getElementById("productQty").value = "";
  document.getElementById("addedBy").value = "";
}

function outwardStock() {
  const nameField = document.getElementById("removeName").value.trim();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();
  const status = document.getElementById("remove-status");

  status.textContent = "";

  if (!nameField || isNaN(qty) || qty <= 0 || !takenBy) {
    status.textContent = "❌ All fields required, quantity must be > 0";
    return;
  }

  const sku = extractSKU(nameField);
  const name = extractName(nameField);
  const ref = firebase.database().ref("products/" + sku);

  ref.once("value").then(snapshot => {
    const current = snapshot.val();
    if (!current || current.quantity < qty) {
      status.textContent = "❌ Not enough stock.";
      return;
    }

    ref.transaction(c => {
      return {
        ...c,
        quantity: c.quantity - qty
      };
    }, (error, committed) => {
      if (error || !committed) {
        status.textContent = "⚠️ Could not remove stock.";
      } else {
        firebase.database().ref("logs").push({
          sku,
          name,
          quantityRemoved: qty,
          takenBy,
          timestamp: new Date().toISOString(),
          action: "outward"
        });
        status.textContent = `✔️ Removed ${qty} of ${name}`;
      }
    });
  });

  document.getElementById("removeName").value = "";
  document.getElementById("removeQty").value = "";
  document.getElementById("takenBy").value = "";
}

function extractSKU(text) {
  const match = text.match(/\(([^)]+)\)$/);
  return match ? match[1] : text.toLowerCase().replace(/\s+/g, "-");
}

function extractName(text) {
  const match = text.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : text.trim();
}

function exportLogs() {
  firebase.database().ref("logs").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert("No logs to export");

    let csv = "SKU,Product,Qty In,Qty Out,Added By,Taken By,Timestamp\n";
    Object.values(data).forEach(log => {
      csv += [
        `"${log.sku || ""}"`,
        `"${log.name || ""}"`,
        `${log.quantityAdded || ""}`,
        `${log.quantityRemoved || ""}`,
        `"${log.addedBy || ""}"`,
        `"${log.takenBy || ""}"`,
        `"${log.timestamp || ""}"`
      ].join(",") + "\n";
    });

    downloadCSV(csv, "logs.csv");
  });
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
}
