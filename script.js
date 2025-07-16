firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadProducts();
  }
});

function loadProducts() {
  firebase.database().ref("products").on("value", snapshot => {
    const productList = document.getElementById("productList");
    if (!productList) return;

    productList.innerHTML = "";

    const data = snapshot.val();
    if (data) {
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

function setupSearch(data) {
  const searchBox = document.getElementById("searchBox");
  const searchResult = document.getElementById("searchResult");

  if (!searchBox) return;

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

function addOrUpdateProduct() {
  const name = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);
  const addedBy = document.getElementById("addedBy").value.trim();
  const status = document.getElementById("add-status");

  status.textContent = "";

  if (!name || isNaN(qty) || qty <= 0 || !addedBy) {
    status.textContent = "❌ All fields are required and quantity must be positive.";
    return;
  }

  const ref = firebase.database().ref("products/" + name);
  ref.transaction(currentQty => {
    return (currentQty || 0) + qty;
  }, (error, committed, snapshot) => {
    if (error || !committed) {
      status.textContent = "⚠️ Failed to update stock.";
    } else {
      const log = {
        product: name,
        quantityAdded: qty,
        addedBy,
        timestamp: new Date().toISOString(),
        action: "added"
      };
      firebase.database().ref("logs").push(log);
      status.textContent = `✅ Stock updated. New: ${snapshot.val()}`;
    }
  });

  document.getElementById("productName").value = "";
  document.getElementById("productQty").value = "";
  document.getElementById("addedBy").value = "";
}

function removeProduct() {
  const name = document.getElementById("removeName").value.trim();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();
  const status = document.getElementById("remove-status");

  status.textContent = "";

  if (!name || isNaN(qty) || qty <= 0 || !takenBy) {
    status.textContent = "❌ All fields are required and quantity must be positive.";
    return;
  }

  const confirmRemove = confirm(`Are you sure you want to remove ${qty} of "${name}"?`);
  if (!confirmRemove) return;

  const ref = firebase.database().ref("products/" + name);
  ref.once("value").then(snapshot => {
    const currentQty = snapshot.val();
    if (currentQty === null || currentQty < qty) {
      status.textContent = "❌ Not enough stock.";
      return;
    }

    ref.transaction(cur => cur - qty, (error, committed) => {
      if (error || !committed) {
        status.textContent = "⚠️ Could not remove product.";
      } else {
        const log = {
          product: name,
          quantityRemoved: qty,
          takenBy,
          timestamp: new Date().toISOString(),
          action: "removed"
        };
        firebase.database().ref("logs").push(log);
        status.textContent = `✔️ Removed ${qty} of ${name}`;
      }
    });
  });

  document.getElementById("removeName").value = "";
  document.getElementById("removeQty").value = "";
  document.getElementById("takenBy").value = "";
}

function toggleProducts() {
  const container = document.getElementById("productContainer");
  const btn = document.getElementById("toggleBtn");

  if (!container || !btn) return;

  if (container.style.display === "none") {
    container.style.display = "block";
    btn.textContent = "🔼 Hide All Products";
  } else {
    container.style.display = "none";
    btn.textContent = "📦 Show All Products";
  }
}

function exportProducts() {
  firebase.database().ref("products").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert("No product data.");

    let csv = "Product,Quantity\n";
    Object.entries(data).forEach(([k, v]) => {
      csv += `${k},${v}\n`;
    });

    downloadCSV(csv, "products.csv");
  });
}

function exportLogs() {
  firebase.database().ref("logs").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert("No logs to export.");

    let csv = "Product,Qty Added,Qty Removed,Added By,Taken By,Timestamp\n";
    Object.values(data).forEach(log => {
      csv += `"${log.product}",${log.quantityAdded || ""},${log.quantityRemoved || ""},"${log.addedBy || ""}","${log.takenBy || ""}","${log.timestamp}"\n`;
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
