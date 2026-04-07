// ===============================
// SESSION CHECK
// ===============================
var supabase = window.supabaseClient;
var currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
  window.location.href = "index.html";
}

document.getElementById("logoutBtn").addEventListener("click", async function () {
  if (supabase) await supabase.auth.signOut();
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
});

// ===============================
// ADD FOUND ITEM (Supabase + Storage)
// ===============================
var form = document.getElementById("foundItemForm");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  var titleEl = document.getElementById("title");
  var categoryEl = document.getElementById("category");
  var descriptionEl = document.getElementById("description");
  var dateFoundEl = document.getElementById("dateFound");
  var locationEl = document.getElementById("location");
  var imageUploadEl = document.getElementById("imageUpload");

  var title = titleEl.value.trim();
  var category = categoryEl.value;
  var description = descriptionEl.value.trim();
  var dateFound = dateFoundEl.value;
  var location = locationEl.value.trim();
  var files = imageUploadEl.files;

  if (!supabase) {
    alert("Supabase not loaded.");
    return;
  }

  // Insert found item first to get id
  var { data: newItem, error: insertError } = await supabase
    .from("found_items")
    .insert({
      user_id: currentUser.id,
      title: title,
      category: category,
      description: description,
      date_found: dateFound,
      location: location,
      image_paths: [],
      status: "available"
    })
    .select("id")
    .single();

  if (insertError) {
    alert("Error: " + insertError.message);
    return;
  }

  var imagePaths = [];
  if (files && files.length > 0) {
    var basePath = currentUser.id + "/" + newItem.id + "/";
    // FIX: capture timestamp once outside the loop.
    // Previously Date.now() was called inside the loop — on fast async uploads
    // multiple files could get the same timestamp, causing filename collisions
    // and silent overwrites in Supabase Storage.
    var uploadTimestamp = Date.now();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var fileName = basePath + uploadTimestamp + "_" + i + "_" + (file.name || "img");
      var { error: uploadError } = await supabase.storage.from("found-images").upload(fileName, file, { upsert: true });
      if (!uploadError) {
        imagePaths.push(fileName);
      }
    }
    if (imagePaths.length > 0) {
      await supabase.from("found_items").update({ image_paths: imagePaths }).eq("id", newItem.id);
    }
  }

  form.reset();
  displayItems();
});

// ===============================
// DISPLAY FOUND ITEMS (Supabase)
// ===============================
async function displayItems() {
  var list = document.getElementById("foundItemsList");
  list.innerHTML = "";

  var searchText = (document.getElementById("searchInput").value || "").toLowerCase();
  var filterCategory = document.getElementById("filterCategory").value;

  if (!supabase) {
    list.innerHTML = "<p>Supabase not loaded.</p>";
    return;
  }

  var { data: items, error } = await supabase.from("found_items").select("*").order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "<p>Error: " + error.message + "</p>";
    return;
  }

  var filtered = (items || []).filter(function (item) {
    var matchSearch = !searchText || (item.title && item.title.toLowerCase().indexOf(searchText) !== -1);
    var matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  filtered.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "card";

    var imagesHTML = "";
    if (item.image_paths && item.image_paths.length) {
      item.image_paths.forEach(function (path) {
        var url = supabase.storage.from("found-images").getPublicUrl(path).data.publicUrl;
        imagesHTML += "<img src=\"" + url + "\" alt=\"Item\" width=\"100\">";
      });
    }

    var requestBtn = "";
    if (item.user_id !== currentUser.id && item.status === "available") {
      requestBtn = "<button onclick=\"openModal(" + item.id + ")\">Request Item</button>";
    }

    card.innerHTML =
      "<h3>" + item.title + "</h3>" +
      "<p><strong>Category:</strong> " + item.category + "</p>" +
      "<p><strong>Description:</strong> " + (item.description || "") + "</p>" +
      "<p><strong>Date Found:</strong> " + item.date_found + "</p>" +
      "<p><strong>Location:</strong> " + item.location + "</p>" +
      imagesHTML +
      requestBtn;
    list.appendChild(card);
  });
}

// ===============================
// MODAL - REQUEST ITEM (Supabase)
// ===============================
var selectedItemId = null;

function openModal(id) {
  selectedItemId = id;
  document.getElementById("requestModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("requestModal").style.display = "none";
  document.getElementById("requestMessage").value = "";
  selectedItemId = null;
}

document.getElementById("sendRequestBtn").addEventListener("click", async function () {
  var message = document.getElementById("requestMessage").value.trim();
  if (!message) {
    alert("Please enter a message.");
    return;
  }
  if (!selectedItemId || !supabase) return;

  var { error } = await supabase.from("requests").insert({
    found_item_id: selectedItemId,
    requester_id: currentUser.id,
    message: message,
    status: "pending"
  });

  if (error) {
    alert("Error: " + error.message);
    return;
  }
  alert("Request Sent!");
  closeModal();
});

// ===============================
// SEARCH + FILTER EVENTS
// ===============================
document.getElementById("searchInput").addEventListener("input", displayItems);
document.getElementById("filterCategory").addEventListener("change", displayItems);

// Initial Load
displayItems();