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
// ADD LOST ITEM (Supabase)
// ===============================
var form = document.getElementById("lostItemForm");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  var titleEl = document.getElementById("title");
  var categoryEl = document.getElementById("category");
  var descriptionEl = document.getElementById("description");
  var dateLostEl = document.getElementById("dateLost");
  var locationEl = document.getElementById("location");

  var title = titleEl.value.trim();
  var category = categoryEl.value;
  var description = descriptionEl.value.trim();
  var dateLost = dateLostEl.value;
  var location = locationEl.value.trim();

  if (!supabase) {
    alert("Supabase not loaded.");
    return;
  }

  var { data, error } = await supabase.from("lost_items").insert({
    user_id: currentUser.id,
    title: title,
    category: category,
    description: description,
    date_lost: dateLost,
    location: location,
    status: "active"
  }).select("id").single();

  if (error) {
    alert("Error: " + error.message);
    return;
  }

  form.reset();
  displayItems();
});

// ===============================
// DISPLAY LOST ITEMS (Supabase)
// ===============================
async function displayItems() {
  var list = document.getElementById("lostItemsList");
  list.innerHTML = "";

  var searchText = (document.getElementById("searchInput").value || "").toLowerCase();
  var filterCategory = document.getElementById("filterCategory").value;

  if (!supabase) {
    list.innerHTML = "<p>Supabase not loaded.</p>";
    return;
  }

  var query = supabase.from("lost_items").select("*").order("created_at", { ascending: false });
  var { data: items, error } = await query;

  if (error) {
    list.innerHTML = "<p>Error: " + error.message + "</p>";
    return;
  }

  var filtered = (items || []).filter(function (item) {
    var matchSearch = !searchText || item.title.toLowerCase().indexOf(searchText) !== -1;
    var matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  filtered.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "card";
    var markBtn = "";
    if (item.status === "active" && item.user_id === currentUser.id) {
      markBtn = "<button onclick=\"markAsFound(" + item.id + ")\">Mark as Found</button>";
    }
    card.innerHTML =
      "<h3>" + item.title + "</h3>" +
      "<p><strong>Category:</strong> " + item.category + "</p>" +
      "<p><strong>Description:</strong> " + (item.description || "") + "</p>" +
      "<p><strong>Date Lost:</strong> " + item.date_lost + "</p>" +
      "<p><strong>Location:</strong> " + item.location + "</p>" +
      "<p><strong>Status:</strong> " + item.status + "</p>" +
      markBtn;
    list.appendChild(card);
  });
}

// ===============================
// MARK AS FOUND (Supabase)
// FIX: added error handling — previously errors were silently swallowed,
// causing stale UI (item still showing as "active") with no user feedback.
// ===============================
async function markAsFound(id) {
  if (!supabase) return;
  var { error } = await supabase
    .from("lost_items")
    .update({ status: "found" })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Could not update status: " + error.message);
    return;
  }
  displayItems();
}

// ===============================
// SEARCH + FILTER EVENTS
// ===============================
document.getElementById("searchInput").addEventListener("input", displayItems);
document.getElementById("filterCategory").addEventListener("change", displayItems);

// Initial Load
displayItems();