figma.showUI(__html__, { width: 320, height: 110, title: "Poker Points" });

const DEFAULTS = {
  fibonacci: ["1","2","3","5","8","13","21","?"],
  modified:  ["0","½","1","2","3","5","8","13","20","40","100","?"],
  tshirt:    ["XS","S","M","L","XL","XXL"]
};

const BADGE_SIZE = 64;
const BADGE_PREFIX = "__estimate__";

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1,3), 16) / 255,
    g: parseInt(hex.slice(3,5), 16) / 255,
    b: parseInt(hex.slice(5,7), 16) / 255
  };
}

function badgeFontSize(value) {
  if (value.length >= 3) return 15;
  if (value.length === 2) return 20;
  return 26;
}

// Extract numeric estimate from a selected node (STICKY or GROUP containing sticky+badge)
function getEstimate(node) {
  var badgeFrame = null;

  if (node.type === "GROUP") {
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.name && child.name.indexOf(BADGE_PREFIX) === 0) {
        badgeFrame = child;
        break;
      }
    }
  } else if (node.type === "STICKY") {
    var name = BADGE_PREFIX + node.id;
    var all = figma.currentPage.children;
    for (var j = 0; j < all.length; j++) {
      if (all[j].name === name) { badgeFrame = all[j]; break; }
    }
  }

  if (!badgeFrame) return null;

  var textNode = null;
  for (var k = 0; k < badgeFrame.children.length; k++) {
    if (badgeFrame.children[k].type === "TEXT") {
      textNode = badgeFrame.children[k];
      break;
    }
  }
  if (!textNode) return null;

  var val = textNode.characters;
  if (val === "?") return null;
  if (val === "½") return 0.5;
  var num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function sendSelection() {
  var selection = figma.currentPage.selection;

  // Count selectable stickies (direct or inside groups)
  var stickyCount = 0;
  for (var i = 0; i < selection.length; i++) {
    var node = selection[i];
    if (node.type === "STICKY") stickyCount++;
    else if (node.type === "GROUP") {
      for (var j = 0; j < node.children.length; j++) {
        if (node.children[j].type === "STICKY") { stickyCount++; break; }
      }
    }
  }

  // Collect numeric estimates
  var estimates = [];
  for (var i = 0; i < selection.length; i++) {
    var val = getEstimate(selection[i]);
    if (val !== null) estimates.push(val);
  }

  figma.ui.postMessage({ type: "selection", count: stickyCount, estimates: estimates });
}

figma.on("selectionchange", sendSelection);

async function attachBadge(sticky, value, colorHex) {
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  // If sticky is inside a group (already estimated), ungroup first so the
  // old badge surfaces to page level and can be found and removed
  if (sticky.parent && sticky.parent.type === "GROUP") {
    figma.ungroup(sticky.parent);
  }

  var badgeName = BADGE_PREFIX + sticky.id;
  [...figma.currentPage.children]
    .filter(function(n) { return n.name === badgeName; })
    .forEach(function(n) { n.remove(); });

  var color = hexToRgb(colorHex);

  var frame = figma.createFrame();
  frame.name = badgeName;
  frame.resize(BADGE_SIZE, BADGE_SIZE);
  frame.cornerRadius = BADGE_SIZE / 2;
  frame.fills = [{ type: "SOLID", color: color }];
  frame.strokes = [];
  frame.effects = [{
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.18 },
    offset: { x: 0, y: 2 },
    radius: 6, spread: 0, visible: true, blendMode: "NORMAL"
  }];

  var text = figma.createText();
  text.fontName = { family: "Inter", style: "Bold" };
  text.characters = value;
  text.fontSize = badgeFontSize(value);
  text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  frame.appendChild(text);
  text.x = (BADGE_SIZE - text.width) / 2;
  text.y = (BADGE_SIZE - text.height) / 2;

  frame.x = sticky.x + sticky.width - BADGE_SIZE * 0.75;
  frame.y = sticky.y - BADGE_SIZE * 0.25;

  figma.currentPage.appendChild(frame);

  var group = figma.group([sticky, frame], figma.currentPage);
  group.name = sticky.name || "Story";
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "ready") {
    const saved = await figma.clientStorage.getAsync("modeValues");
    figma.ui.postMessage({ type: "loadValues", values: saved || DEFAULTS });
    sendSelection();
  }

  if (msg.type === "stamp") {
    const stickies = [];
    figma.currentPage.selection.forEach(function(n) {
      if (n.type === "STICKY") {
        stickies.push(n);
      } else if (n.type === "GROUP") {
        for (var j = 0; j < n.children.length; j++) {
          if (n.children[j].type === "STICKY") { stickies.push(n.children[j]); break; }
        }
      }
    });
    for (var i = 0; i < stickies.length; i++) {
      await attachBadge(stickies[i], msg.value, msg.color);
    }
  }

  if (msg.type === "saveValues") {
    await figma.clientStorage.setAsync("modeValues", msg.values);
  }

  if (msg.type === "resize") {
    figma.ui.resize(320, Math.max(80, msg.height + 2));
  }
};

figma.on("drop", async (event) => {
  const item = event.items.find(function(i) { return i.type === "text/plain"; });
  if (!item) return false;

  let parsed;
  try { parsed = JSON.parse(item.data); } catch (e) { return false; }

  const { value, color } = parsed;
  if (!value || !color) return false;

  let target = event.node;
  while (target && target.type !== "STICKY" && target.type !== "PAGE") {
    target = target.parent;
  }
  if (!target || target.type !== "STICKY") return false;

  await attachBadge(target, value, color);
  return true;
});
