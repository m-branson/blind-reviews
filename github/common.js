"use strict";

function parsePR(url) {
  const match = url.match(/^(https:\/\/github.com)?\/([\w-]+\/[\w-]+\/pull\/[\d]+)/);
  return match && match[2];
}

function storage(pr, visible) {
  if (!pr) {
    pr = parsePR(location.href);
  }
  return new Promise(async resolve => {
    if (visible != null) {
      return chrome.storage.sync.set({[pr]: +visible}, resolve);
    }
    chrome.storage.sync.get(pr, result => resolve(result[pr]));
  });
}

const observer = {
  listeners: new Map(),

  observe(mutations) {
    // Multiple events get coalesced when inserting nested nodes,
    // using a Set ensures we run the listener once per matched node.

    for (const [selector, listener] of observer.listeners) {
      const matched = new Set();

      for (const record of mutations) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            node.querySelectorAll(selector).forEach(m => matched.add(m));
          }
        }
      }
      matched.forEach(listener);
    }
  },

  on(selector, listener) {
    if (!this.observer) {
      this.observer = new MutationObserver(this.observe);
      this.observer.observe(document, {childList: true, subtree: true});
    }

    this.listeners.set(selector, listener);
    document.querySelectorAll(selector).forEach(listener);
  },
};

async function listing(svg) {
  const li = svg.closest("li");
  const href = li.querySelector(`a[href*="/pull/"`).getAttribute("href");
  li.classList.toggle("br-blind", !await storage(parsePR(href)));
}

observer.on("li.js-notification svg.octicon-git-pull-request", listing);
observer.on("li.js-issue-row svg.octicon-git-pull-request", listing);

function augment(a) {
  if (a.classList.contains("br-author")) {
    return;
  }
  const author = document.querySelector("a.author.pull-header-username");
  const who = a.getAttribute("href") || a.getAttribute("alt") || a.textContent;

  if (author && who.endsWith(author.textContent.trim())) {
    const redacted = document.createElement("span");
    a.parentNode.insertBefore(redacted, a);
    redacted.className = "br-redacted";

    a.classList.add("br-author");
    if (a.tagName === "IMG" || a.querySelector("img")) {
      redacted.className = "br-avatar";
    }
  }
}

const control = `<div id="br-toggle" class="dropdown js-menu-container">
  <span  class="js-menu-target btn-link">
    <button class="btn-link tooltipped tooltipped-n" aria-label="Blind Reviews"></button>
    <span class="dropdown-caret"></span>
  </span>

  <div class="dropdown-menu-content anim-scale-in js-menu-content">
    <div class="dropdown-menu dropdown-menu-se">
      <button class="br-toggle dropdown-item dropdown-signout">PR author</button>
    </div>
  </div>
</div>`;

observer.on("div.timeline-comment-header a.author", augment);
observer.on("div.discussion-item a.author", augment);
observer.on("div.avatar-parent-child > a", augment);
observer.on("div.commit-avatar > a", augment);

observer.on("h3.discussion-item-header > img.avatar", augment);

observer.on("div.participation-avatars > a.participant-avatar", augment);
observer.on("div.commit-meta > a.commit-author", augment);

observer.on("div.flash > div > a.text-emphasized", augment);
observer.on("div.gh-header-meta span.head-ref > span.user", augment);

async function toggle(e) {
  if (e.target.classList.contains("br-toggle")) {
    await storage(null, !document.body.classList.toggle("br-blinded"));
    document.body.dispatchEvent(new Event("click", {bubbles: true}));
  }
}

async function prHeader(a) {
  if (a.classList.contains("br-author")) {
    return;
  }

  const parent = a.parentElement.previousElementSibling;
  parent.innerHTML += control;

  document.body.classList.toggle("br-blinded", !await storage());

  augment(a);
}

observer.on("a.author.pull-header-username", prHeader);

document.documentElement.addEventListener("click", toggle);