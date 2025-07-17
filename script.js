// Firebase v8
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", function () {
  const productNameInput = document.getElementById("productName");
  const skuInput = document.getElementById("sku");
  const quantityInput = document.getElementById("quantity");
  const inwardBtn = document.getElementById("addBtn");
  const outwardBtn = document.getElementById("removeBtn");
  const outwardNameInput = document.getElementById("outwardName");
  const outwardProductInput = document.getElementById("outwardProduct");
  const searchInput = document.getElementById("searchInput");
  const tableBody = document.querySelector("#productTable tbody");
  const downloadBtn = document.getElementById("downloadBtn");
  const suggestions = document.getElementById("suggestions");
  const outwardSuggestions = document.getElementById("outwardSuggestions");
  const searchSuggestions = document.getElementById("searchSuggestions");

  // Load stock data
  function loadStock() {
    database.ref("stock").once("value", (snapshot) => {
      tableBody.innerHTML = "";
      snapshot.forEach((childSnapshot) => {
        const item = childSnapshot.val();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.name}</td>
          <td>${item.sku}</td>
          <td>${item.quantity}</td>
        `;
        tableBody.appendChild(tr);
      });
    });
  }

  loadStock();

  // Suggestion dropdown logic
  function setupAutoSuggest(input, suggestionBox) {
    input.addEventListener("input", () => {
      const query = input.value.toLowerCase();
      database.ref("stock").once("value", (snapshot) => {
        suggestionBox.innerHTML = "";
        snapshot.forEach((child) => {
          const item = child.val();
          if (
            item.name.toLowerCase().startsWith(query) ||
            item.sku.toLowerCase().startsWith(query)
          ) {
            const option = document.createElement("div");
            option.textContent = `${item.name} (${item.sku})`;
            option.className = "suggestion-item";
            option.addEventListener("click", () => {
              input.value = item.name;
              suggestionBox.innerHTML = "";
            });
            suggestionBox.appendChild(option);
          }
        });
      });
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        suggestionBox.innerHTML = "";
      }, 200);
    });
  }

  setupAutoSuggest(productNameInput, suggestions);
  setupAutoSuggest(outwardProductInput, outwardSuggestions);
  setupAutoSuggest(searchInput, searchSuggestions);

  // Inward Stock
  inwardBtn.addEventListener("click", () => {
    const name = productNameInput.value.trim();
    const sku = skuInput.value.trim();
    const quantity = parseInt(quantityInput.value.trim());

    if (!name || !sku || isNaN(quantity)) return alert("Enter valid details");

    const stockRef = database.ref("stock/" + sku);
    stockRef.once("value", (snapshot) => {
      let updatedQuantity = quantity;
      if (snapshot.exists()) {
        updatedQuantity += snapshot.val().quantity;
      }

      stockRef.set({
        name,
        sku,
        quantity: updatedQuantity,
      });

      database.ref("logs").push({
        type: "inward",
        name,
        sku,
        quantity,
        receiver: firebase.auth().currentUser.email,
        takenBy: "-",
        timestamp: new Date().toLocaleString(),
      });

      productNameInput.value = "";
      skuInput.value = "";
      quantityInput.value = "";
      loadStock();
    });
  });

  // Outward Stock
  outwardBtn.addEventListener("click", () => {
    const name = outwardProductInput.value.trim();
    const takenBy = outwardNameInput.value.trim();

    if (!name || !takenBy) return alert("Enter product and name");

    const stockRef = database.ref("stock");
    stockRef.once("value", (snapshot) => {
      let found = false;
      snapshot.forEach((child) => {
        const item = child.val();
        if (item.name === name || item.sku === name) {
          found = true;
          if (item.quantity > 0) {
            const updatedQty = item.quantity - 1;
            database.ref("stock/" + item.sku).update({ quantity: updatedQty });

            database.ref("logs").push({
              type: "outward",
              name: item.name,
              sku: item.sku,
              quantity: 1,
              receiver: "-",
              takenBy: takenBy,
              timestamp: new Date().toLocaleString(),
            });

            loadStock();
            outwardProductInput.value = "";
            outwardNameInput.value = "";
          } else {
            alert("Out of stock!");
          }
        }
      });
      if (!found) alert("Product not found");
    });
  });

  // Search filtering
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    database.ref("stock").once("value", (snapshot) => {
      tableBody.innerHTML = "";
      snapshot.forEach((child) => {
        const item = child.val();
        if (
          item.name.toLowerCase().startsWith(query) ||
          item.sku.toLowerCase().startsWith(query)
        ) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.sku}</td>
            <td>${item.quantity}</td>
          `;
          tableBody.appendChild(tr);
        }
      });
    });
  });

  // Export to CSV
  downloadBtn.addEventListener("click", () => {
    database.ref("logs").once("value", (snapshot) => {
      let csv = "Product,Quantity,Taken By,Receiver,Date Time\n";
      snapshot.forEach((log) => {
        const item = log.val();
        csv += `${item.name},${item.quantity},${item.takenBy},${item.receiver},${item.timestamp}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "stock_logs.csv";
      link.click();
    });
  });
});
