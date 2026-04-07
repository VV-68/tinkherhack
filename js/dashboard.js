// ===============================
// SESSION CHECK
// FIX: everything is now inside an async init() function that waits for
// supabase.auth.getSession() to resolve BEFORE running any UI or tab logic.
// Previously getSession() was a fire-and-forget .then() — the rest of the
// page (showTab, delete buttons) ran immediately without waiting, so on a
// refresh or expired session, RLS blocked deletes silently because Supabase
// saw the user as unauthenticated even though localStorage still had the user.
// ===============================
var supabase = window.supabaseClient;
var currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
  window.location.href = "index.html";
}

async function init() {
  if (supabase) {
    var _ref = await supabase.auth.getSession();
    var session = _ref.data.session;
    if (!session) {
      localStorage.removeItem("currentUser");
      window.location.href = "index.html";
      return;
    }
  }

  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem("currentUser");
      window.location.href = "index.html";
    });
  }

  // ===============================
  // USER INFO
  // ===============================
  var userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.innerHTML = "<h3>" + currentUser.name + "</h3><p>Email: " + currentUser.email + "</p><p>Roll No: " + (currentUser.roll || "") + "</p>";
  }

  // ===============================
  // DEFAULT TAB
  // ===============================
  showTab("lost");
}

// ===============================
// TAB SYSTEM
// ===============================
function showTab(tab) {
  var container = document.getElementById("tabContent");
  if (!container) return;
  container.innerHTML = "";
  if (tab === "lost") showLostItems();
  if (tab === "found") showFoundItems();
  if (tab === "requests") showRequests();
}

// ===============================
// MY LOST ITEMS (Supabase)
// ===============================
async function showLostItems() {
  var container = document.getElementById("tabContent");
  if (!supabase) {
    container.innerHTML = "<p>Supabase not loaded.</p>";
    return;
  }
  var { data: items, error } = await supabase
    .from("lost_items")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p>Error: " + error.message + "</p>";
    return;
  }
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No lost items posted.</p>";
    return;
  }

  items.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "card";
    card.innerHTML = "<h3>" + item.title + "</h3><p>Status: " + item.status + "</p><button onclick=\"deleteLost(" + item.id + ")\">Delete</button>";
    container.appendChild(card);
  });
}

async function deleteLost(id) {
  if (!supabase) return;
  var { error } = await supabase
    .from("lost_items")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Could not delete item: " + error.message);
    return;
  }
  showLostItems();
}

// ===============================
// MY FOUND ITEMS (Supabase)
// ===============================
async function showFoundItems() {
  var container = document.getElementById("tabContent");
  if (!supabase) {
    container.innerHTML = "<p>Supabase not loaded.</p>";
    return;
  }
  var { data: items, error } = await supabase
    .from("found_items")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p>Error: " + error.message + "</p>";
    return;
  }
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No found items posted.</p>";
    return;
  }

  items.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "card";
    var imagesHTML = "";
    if (item.image_paths && item.image_paths.length) {
      item.image_paths.forEach(function (path) {
        var url = supabase.storage.from("found-images").getPublicUrl(path).data.publicUrl;
        imagesHTML += "<img src=\"" + url + "\" width=\"100\" alt=\"\">";
      });
    }
    card.innerHTML = "<h3>" + item.title + "</h3>" + imagesHTML + "<p>Status: " + item.status + "</p><button onclick=\"deleteFound(" + item.id + ")\">Delete</button> <button onclick=\"viewItemRequests(" + item.id + ")\">View Requests</button>";
    container.appendChild(card);
  });
}

async function deleteFound(id) {
  if (!supabase) {
    alert("Supabase not loaded.");
    return;
  }
  var idNum = typeof id === "number" ? id : parseInt(id, 10);
  if (isNaN(idNum)) {
    alert("Invalid item.");
    return;
  }
  var { error } = await supabase
    .from("found_items")
    .delete()
    .eq("id", idNum)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Could not delete item: " + error.message);
    return;
  }
  showFoundItems();
}

// ===============================
// VIEW REQUESTS FOR MY ITEMS
// ===============================
async function viewItemRequests(foundItemId) {
  var container = document.getElementById("tabContent");
  container.innerHTML = "<h3>Requests</h3>";
  if (!supabase) return;

  var { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("found_item_id", foundItemId);

  if (error) {
    container.innerHTML += "<p>Error: " + error.message + "</p>";
    return;
  }
  if (!requests || requests.length === 0) {
    container.innerHTML += "<p>No requests yet.</p>";
    return;
  }

  requests.forEach(function (req) {
    var card = document.createElement("div");
    card.className = "card";
    var actions = req.status === "pending"
      ? "<button onclick=\"updateRequest(" + req.id + ", 'accepted')\">Accept</button> <button onclick=\"updateRequest(" + req.id + ", 'rejected')\">Reject</button>"
      : "";
    card.innerHTML = "<p><strong>Message:</strong> " + req.message + "</p><p>Status: " + req.status + "</p>" + actions;
    container.appendChild(card);
  });
}

async function updateRequest(id, status) {
  if (!supabase) return;
  var { error } = await supabase
    .from("requests")
    .update({ status: status })
    .eq("id", id);

  if (error) {
    alert("Could not update request: " + error.message);
    return;
  }
  showTab("found");
}

// ===============================
// MY REQUESTS (WHAT I SENT)
// ===============================
async function showRequests() {
  var container = document.getElementById("tabContent");
  if (!supabase) {
    container.innerHTML = "<p>Supabase not loaded.</p>";
    return;
  }
  var { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("requester_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p>Error: " + error.message + "</p>";
    return;
  }
  if (!requests || requests.length === 0) {
    container.innerHTML = "<p>No requests sent.</p>";
    return;
  }

  requests.forEach(function (req) {
    var card = document.createElement("div");
    card.className = "card";
    card.innerHTML = "<p><strong>Message:</strong> " + req.message + "</p><p>Status: " + req.status + "</p>";
    container.appendChild(card);
  });
}

// ===============================
// START
// ===============================
init();