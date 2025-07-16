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

// Add or update product quantity
function addOrUpdateProduct() {
  const name = document.getElementById("productName").value.trim();
  const qty = parseInt(document.getElementById("productQty").value);

  if (!name || isNaN(qty)) {
    alert("Enter valid product name and quantity.");
    return;
  }

  const productRef = db.ref(`products/${name}`);

  productRef.once("value").then(snapshot => {
    if (snapshot.exists()) {
      const confirmUpdate = confirm(
        `"${name}" already exists with quantity ${snapshot.val()}. Do you want to add ${qty} more?`
      );
      if (confirmUpdate) {
        productRef.set(snapshot.val() + qty);
      }
    } else {
      productRef.set(qty);
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

  if (!name || isNaN(qty) || !takenBy) {
    alert("Please fill in product name, quantity, and person name.");
    return;
  }

  db.ref(`products/${name}`).once("value").then(snapshot => {
    const currentQty = snapshot.val();

    if (currentQty === null) {
      alert("Product not found.");
    } else if (currentQty < qty) {
      alert("Not enough stock to remove.");
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
    }
  });

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

