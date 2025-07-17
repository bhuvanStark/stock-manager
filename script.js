const db = firebase.database();
const productRef = db.ref("products");
const logRef = db.ref("stockLogs");

firebase.auth().onAuthStateChanged((user) => {
  if (!user && location.pathname.includes("index.html")) {
    window.location.href = "login.html";
  }
});

function getDatetime() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function inwardStock() {
  const sku = skuVal();
  const name = nameVal();
  const qty = +document.getElementById("quantity").value;
  const receiver = document.getElementById("receiver").value.trim();

  if (!sku || !name || !qty) return alert("Enter SKU, Name, Quantity");

  productRef.child(sku).once("value", (snap) => {
    const prev = snap.val();
    const newQty = prev ? prev.quantity + qty : qty;
    productRef.child(sku).set({ sku, name, quantity: newQty });

    logRef.push({ sku, name, quantity: qty, takenBy: "-", receiver, datetime: getDatetime() });
    alert("Inward stock added!");
    refreshSuggestions();
  });
}

function outwardStock() {
  const sku = skuVal();
  const name = nameVal();
  const qty = +document.getElementById("quantity").value;
  const takenBy = document.getElementById("takenBy").value.trim();

  if (!sku || !name || !qty) return alert("Enter SKU, Name, Quantity");

  productRef.child(sku).once("value", (snap) => {
    const prev = snap.val();
    if (!prev || prev.quantity < qty) return alert("Not enough stock");

    productRef.child(sku).update({ quantity: prev.quantity - qty });
    logRef.push({ sku, name, quantity: qty, takenBy, receiver: "-", datetime: getDatetime() });
    alert("Outward stock updated!");
    refreshSuggestions();
  });
}

function skuVal() {
  return document.getElementById("sku").value.trim();
}

function nameVal() {
  return document.getElementById("productName").value.trim();
}

function searchProduct() {
  const term = document.getElementById("searchInput").value.toLowerCase();
  productRef.once("value", (snapshot) => {
    const div = document.getElementById("productList");
    div.innerHTML = "";
    snapshot.forEach((snap) => {
      const item = snap.val();
      if (item.name.toLowerCase().startsWith(term) || item.sku.toLowerCase().startsWith(term)) {
        div.innerHTML += `<p><strong>${item.sku}</strong> - ${item.name} | Qty: ${item.quantity}</p>`;
      }
    });
  });
}

function downloadCSV() {
  logRef.once("value", (snap) => {
    let csv = "SKU,Name,Quantity,Taken By,Receiver,DateTime\n";
    snap.forEach((child) => {
      const d = child.val();
      csv += `${d.sku || "-"},${d.name || "-"},${d.quantity || 0},${d.takenBy || "-"},${d.receiver || "-"},${d.datetime || "-"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_log.csv";
    a.click();
  });
}

function logout() {
  firebase.auth().signOut().then(() => location.href = "login.html");
}

function refreshSuggestions() {
  productRef.once("value", (snap) => {
    const skuList = document.getElementById("skuList");
    const nameList = document.getElementById("nameList");
    skuList.innerHTML = "";
    nameList.innerHTML = "";
    snap.forEach((s) => {
      const d = s.val();
      skuList.innerHTML += `<option value="${d.sku}"/>`;
      nameList.innerHTML += `<option value="${d.name}"/>`;
    });
  });
}

window.onload = refreshSuggestions;
