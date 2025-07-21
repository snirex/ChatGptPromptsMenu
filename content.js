(() => {
  // === Add main floating menu styles ===
  const style = document.createElement('style');
  style.textContent = `
    #floatingMenu {
      position: fixed;
      top: 100px;
      right: 10px;
      width: 270px;
      max-height: 400px;
      background: rgba(0,0,0,0.6);
      color: white;
      font-family: Arial, sans-serif;
      font-size: 14px;
      border-radius: 6px;
      box-shadow: 0 0 10px black;
      display: flex;
      flex-direction: column;
      user-select: none;
      z-index: 999999;
      overflow: hidden;
      transition: max-height 0.4s ease, box-shadow 0.4s ease;
      border: 1px solid gray;
    }
    #floatingMenu.collapsed {
      max-height: 40px;
    }
    #floatingMenuHeader {
      padding: 8px 10px;
      background: rgba(0,0,0,0.8);
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
    }
    #floatingMenuTitle {
      flex-grow: 1;
      text-align: center;
    }
    #floatingMenuControls {
      display: flex;
      align-items: center;
    }
    #floatingMenuControls > button {
      cursor: pointer;
      margin-left: 10px;
      font-weight: bold;
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #floatingMenuControls > button:focus {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    #searchInput {
      margin: 0 10px;
      padding: 5px 8px;
      border-radius: 4px;
      border: none;
      font-size: 14px;
      width: calc(100% - 20px);
      box-sizing: border-box;
      max-height: 0;
      opacity: 0;
      pointer-events: none;
      transition: max-height 0.4s ease, opacity 0.4s ease, margin 0.4s ease;
      direction: rtl;
    }
    #searchInput.visible {
      max-height: 40px;
      opacity: 1;
      pointer-events: auto;
      margin: 5px 10px;
    }
    #floatingMenuList {
      padding: 5px 10px;
      transition: opacity 0.3s ease;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #floatingMenuList.scrollable {
      overflow-y: auto;
      max-height: 340px;
    }
    #floatingMenuList div {
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      background: rgba(255,255,255,0.1);
      cursor: pointer;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow-x: clip;
    }
    #floatingMenuList div:hover,
    #floatingMenuList div:focus {
      background: rgba(255,255,255,0.25);
      outline: none;
    }
    #floatingMenu.collapsed #searchInput,
    #floatingMenu.collapsed #floatingMenuList {
      opacity: 0;
      pointer-events: none;
      height: 0;
      padding: 0 10px;
      overflow: hidden !important;
      transition: opacity 0.4s ease, height 0.4s ease, padding 0.4s ease, margin 0.4s ease;
    }

    /* === Balloon styles === */
    #snirBalloon {
      position: absolute;
      background: black;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      box-shadow: 0 0 8px white;
      white-space: nowrap;
      pointer-events: auto;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 1000000;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    @keyframes bounce {
      0%   { transform: translateY(0); }
      30%  { transform: translateY(-10px); }
      50%  { transform: translateY(0); }
      70%  { transform: translateY(-5px); }
      100% { transform: translateY(0); }
    }
    #snirBalloon.bounce {
      animation: bounce 0.6s ease;
    }
  `;
  document.head.appendChild(style);

  // === Build main menu elements ===
  const empty = 'ריק';
  const q_menu = 'תפריט שאלות';
  const menu = document.createElement('div');
  menu.id = 'floatingMenu';
  menu.setAttribute('role', 'region');
  menu.setAttribute('aria-label', q_menu);

  const header = document.createElement('div');
  header.id = 'floatingMenuHeader';
  header.setAttribute('role', 'banner');

  const title = document.createElement('div');
  title.id = 'floatingMenuTitle';
  title.textContent = empty;

  const controls = document.createElement('div');
  controls.id = 'floatingMenuControls';

  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'collapseBtn';
  collapseBtn.textContent = '-';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'closeBtn';
  closeBtn.textContent = '×';

  controls.appendChild(collapseBtn);
  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);

  const searchInput = document.createElement('input');
  searchInput.id = 'searchInput';
  searchInput.type = 'search';
  searchInput.placeholder = 'חפש שאלות...';

  const listContainer = document.createElement('div');
  listContainer.id = 'floatingMenuList';

  menu.appendChild(header);
  menu.appendChild(searchInput);
  menu.appendChild(listContainer);
  document.body.appendChild(menu);

  // === Helper functions ===

  // Check if character is Hebrew
  function isHebrewChar(char) {
    return /[\u0590-\u05FF]/.test(char);
  }

  // Check if element or its parent has a given class
  function hasClassOrParentHasClass(el, className) {
    while (el) {
      if (el.classList && el.classList.contains(className)) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  // Collect all questions in page
  function getQuestions() {
    const qs = document.querySelectorAll('.whitespace-pre-wrap');
    const questions = [];
    qs.forEach((q, i) => {
      if (hasClassOrParentHasClass(q, 'text-page-header')) return;
      let text = q.textContent.trim().replace(/\s+/g, ' ');
      questions.push({ el: q, text, index: i, fullText: q.textContent.trim() });
    });
    return questions;
  }

  // Keep track of previous state to detect changes
  let previousQuestionsJSON = null;

  // Update the questions list
  function updateList() {
    const questions = getQuestions();
    const currentQuestionsJSON = JSON.stringify(questions.map(q => q.fullText));
    if (currentQuestionsJSON === previousQuestionsJSON) return;
    previousQuestionsJSON = currentQuestionsJSON;

    if (questions.length === 0) {
      title.textContent = empty;
    } else {
      title.textContent = document.title || 'צ׳אט';
    }

    const firstChar = title.textContent.trim().charAt(0);
    if (isHebrewChar(firstChar)) {
      title.style.direction = 'rtl';
    } else {
      title.style.direction = 'ltr';
    }

    const searchTerm = searchInput.value.trim().toLowerCase();
    listContainer.innerHTML = '';

    const filtered = questions.filter(q => q.fullText.toLowerCase().includes(searchTerm));
    listContainer.classList.toggle('scrollable', filtered.length > 10);

    if (filtered.length === 0) {
      const noResultDiv = document.createElement('div');
      noResultDiv.textContent = 'לא נמצאו שאלות';
      noResultDiv.style.textAlign = 'center';
      noResultDiv.style.opacity = '0.7';
      listContainer.appendChild(noResultDiv);
      return;
    }

    filtered.forEach(({ el, text, index, fullText }) => {
      const item = document.createElement('div');
      item.textContent = text || `שאלה ${index + 1}`;
      item.title = fullText;

      if (isHebrewChar(text[0])) {
        item.style.direction = 'rtl';
        item.style.textAlign = 'right';
      } else {
        item.style.direction = 'ltr';
        item.style.textAlign = 'left';
      }

      item.addEventListener('click', e => {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.5s';
        const origBG = el.style.backgroundColor;
        const origTextColor = el.style.color;
        const origBoxShadow = el.style.boxShadow;
        el.style.backgroundColor = 'yellow';
        el.style.color = 'black';
        el.style.boxShadow = '0 0 6px yellow';
        setTimeout(() => {
          el.style.color = origTextColor || '';
          el.style.backgroundColor = origBG || '';
          el.style.boxShadow = origBoxShadow;
        }, 1000);
      });

      listContainer.appendChild(item);
    });
  }

  // === Controls actions ===
  closeBtn.addEventListener('click', () => {
    menu.style.display = 'none';
  });

  collapseBtn.addEventListener('click', () => {
    const isCollapsed = menu.classList.toggle('collapsed');
    collapseBtn.textContent = isCollapsed ? '+' : '-';
  });

  searchInput.addEventListener('input', () => {
    updateList();
  });

  // === Dragging logic ===
  let isDragging = false, dragStartX, dragStartY, menuStartX, menuStartY;

  header.addEventListener('mousedown', e => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = menu.getBoundingClientRect();
    menuStartX = rect.left;
    menuStartY = rect.top;
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    let newX = menuStartX + (e.clientX - dragStartX);
    let newY = menuStartY + (e.clientY - dragStartY);
    const maxX = window.innerWidth - menu.offsetWidth - 10;
    const maxY = window.innerHeight - menu.offsetHeight - 10;
    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));
    menu.style.right = 'auto';
    menu.style.left = `${newX}px`;
    menu.style.top = `${newY}px`;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // === Mutation observer to auto-refresh list ===
  const observer = new MutationObserver(() => {
    updateList();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  updateList();

  // === Adjust shadow if dark mode ===
  const html = document.documentElement;
  const updateShadow = () => {
    if (html.classList.contains('dark')) {
      menu.style.boxShadow = '0 0 10px white';
      header.style.boxShadow = '0 0 6px white';
    } else {
      menu.style.boxShadow = '0 0 10px black';
      header.style.boxShadow = '';
    }
  };
  updateShadow();
  const htmlObserver = new MutationObserver(updateShadow);
  htmlObserver.observe(html, { attributes: true, attributeFilter: ['class'] });

  // === Balloon element ===
  const balloon = document.createElement('div');
  balloon.id = 'snirBalloon';
  balloon.textContent = 'Snir Elgabsi';
  document.body.appendChild(balloon);

  let hideBalloonTimeout;

  // Show balloon on double click
  title.addEventListener('dblclick', () => {
    const rect = title.getBoundingClientRect();
    balloon.style.left = `${rect.left + rect.width / 2}px`;
    balloon.style.top = `${rect.top - 30}px`;
    balloon.style.opacity = '1';

    balloon.classList.add('bounce');
    setTimeout(() => balloon.classList.remove('bounce'), 600);

    clearTimeout(hideBalloonTimeout);
    hideBalloonTimeout = setTimeout(() => {
      balloon.style.opacity = '0';
    }, 3000);
  });
/*
  // Hide balloon on mouse leave
  title.addEventListener('mouseleave', () => {
    balloon.style.opacity = '0';
    clearTimeout(hideBalloonTimeout);
  });
*/
  // Open blog on balloon click
  balloon.addEventListener('click', () => {
    window.open('https://snir.blogspot.com', '_blank');
  });

})();
