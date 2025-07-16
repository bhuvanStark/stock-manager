// Wait for Firebase Auth to confirm user is logged in
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadProducts(); // Load data if logged in
  }
});

const db = firebase.database();

// Load and display all products
function loadProducts() {
  db.ref("products").on("value", snapshot => {
    const productList = document.getElementById("productList");
    productList.innerHTML = "";

    const data = snapshot.val();
    if (data) {
      // Attach search functionality
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

// To Search 
function setupSearch(data) {
  const searchBox = document.getElementById("searchBox");
  const searchResult = document.getElementById("searchResult");

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


// Add or update product quantity
function addOrUpdateProduct() {
  const name = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);
  const status = document.getElementById("add-status");
  status.textContent = "";

  if (!name) {
    status.textContent = "Product name cannot be empty.";
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    status.textContent = "Quantity must be a positive number.";
    return;
  }

  const productRef = db.ref(`products/${name}`);

  productRef.transaction(current => {
    return (current || 0) + qty;
  }, (error, committed, snapshot) => {
    if (error) {
      status.textContent = "Error updating product. Try again.";
    } else if (!committed) {
      status.textContent = "Update not committed.";
    } else {
      status.textContent = `✔️ Product updated. New quantity: ${snapshot.val()}`;
    }
  });

  document.getElementById("productName").value = "";
  document.getElementById("productQty").value = "";
}

// Remove stock and log action
function removeProduct() {
  const name = document.getElementById("removeName").value.trim();
  const qty = parseInt(document.getElementById("removeQty").value);
  const takenBy = document.getElementById("takenBy").value.trim();
  const status = document.getElementById("remove-status");
  status.textContent = "";

  if (!name) {
    status.textContent = "Enter product name.";
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    status.textContent = "Enter a valid quantity to remove.";
    return;
  }

  if (!takenBy) {
    status.textContent = "Please enter who is taking the item.";
    return;
  }

  // Confirm before proceeding
  const confirmRemove = confirm(`Are you sure you want to remove ${qty} of "${name}"?`);
  if (!confirmRemove) return;

  // Proceed with stock deduction and log
  db.ref(`products/${name}`).once("value").then(snapshot => {
    const currentQty = snapshot.val();

    if (currentQty === null) {
      status.textContent = "Product not found.";
    } else if (currentQty < qty) {
      status.textContent = "Not enough stock to remove.";
    } else {
      // Update stock
      db.ref(`products/${name}`).set(currentQty - qty);

      // Log the removal
      const logEntry = {
        product: name,
        quantityRemoved: qty,
        takenBy: takenBy,
        timestamp: new Date().toISOString()
      };

      db.ref("logs").push(logEntry);
      status.textContent = "Stock removed and logged.";
    }
  });

  // Clear fields
  document.getElementById("removeName").value = "";
  document.getElementById("removeQty").value = "";
  document.getElementById("takenBy").value = "";
}

// Logout function
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
}

