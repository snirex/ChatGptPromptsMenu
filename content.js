(() => {
    /** --- יצירת סגנונות --- */
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #floatingMenu {
            position: fixed;
            top: 100px;
            right: 10px;
            width: 300px;
            max-height: 450px;
            background: rgba(0,0,0,0.7);
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            border-radius: 6px;
            box-shadow: 0 0 12px black;
            display: flex;
            flex-direction: column;
            user-select: none;
            z-index: 999999;
            overflow: hidden;
            transition: max-height 0.4s ease;
        }
        #floatingMenu.collapsed { max-height: 40px; }
        #floatingMenuHeader {
            padding: 8px 10px;
            background: rgba(0,0,0,0.85);
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
        }
        #floatingMenuTitle { flex-grow: 1; }
        #floatingMenuControls { display: flex; align-items: center; }
         button:not(.keyboard-toggle) {
            cursor: pointer; color: white; margin-left: 6px;
            font-weight: bold; user-select: none;
            background: none; border: none;
            font-size: 16px; line-height: 1; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
         .keyboard-toggle {
            cursor: pointer; color: white; font-size: 16px;
            line-height: 1; padding: 4px 6px; border-radius: 4px;
            transition: background 0.3s ease; margin-left: 6px;
        }
         .keyboard-toggle.on { background: #2ecc71; }
         .keyboard-toggle.off { background: #7f8c8d; }

        #searchInput {
            margin: 3px 10px; padding: 5px 8px; border-radius: 4px;
            border: none; font-size: 14px; width: calc(100% - 20px);
            box-sizing: border-box; direction: rtl;
            color: black;
        }
        #floatingMenuList {
            padding: 5px 10px;
            transition: opacity 0.4s ease;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #floatingMenuList.fade { opacity: 0; }
        #floatingMenuList.scrollable {
            overflow-y: auto;
            max-height: 380px;
        }
        #floatingMenuList div {
            padding: 5px 8px;
            border-radius: 4px;
            margin-bottom: 4px;
            background: rgba(255,255,255,0.1);
            cursor: pointer;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow-x: hidden;
            max-width: 100%;
            box-sizing: border-box;
            transition: background 0.25s ease, color 0.25s ease;
        }
        #floatingMenuList div:hover { background: rgba(255,255,255,0.25); }
        #highlight { background: yellow; color: black; font-weight: bold; }
        #floatingMenu.collapsed #searchInput,
        #floatingMenu.collapsed #floatingMenuList {
            opacity: 0; pointer-events: none; height: 0; padding: 0 10px;
            overflow: hidden !important;
            transition: opacity 0.4s ease, height 0.4s ease, padding 0.4s ease, margin 0.4s ease;
        }
        #floatingMenuList .active {
            background: orange !important; color: black !important; transform: scale(1.02);
        }
    `;
    document.head.appendChild(styleElement);

    /** --- מבנה התפריט --- */
    const floatingMenu = document.createElement('div');
    floatingMenu.id = 'floatingMenu';

    const header = document.createElement('div');
    header.id = 'floatingMenuHeader';

    const title = document.createElement('div');
    title.id = 'floatingMenuTitle';
    title.textContent = 'פוסטים';

    const controls = document.createElement('div');
    controls.id = 'floatingMenuControls';

    const collapseButton = document.createElement('button');
    collapseButton.textContent = '-';

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';

    const keyboardToggleButton = document.createElement('button');
    keyboardToggleButton.textContent = '↕';
    keyboardToggleButton.classList.add('keyboard-toggle', 'on');

    controls.appendChild(collapseButton);
    controls.appendChild(closeButton);
    header.appendChild(keyboardToggleButton);

    header.appendChild(title);
    header.appendChild(controls);

    const searchInput = document.createElement('input');
    searchInput.id = 'searchInput';
    searchInput.placeholder = 'חפש פוסטים...';

    const postsListContainer = document.createElement('div');
    postsListContainer.id = 'floatingMenuList';

    floatingMenu.appendChild(header);
    floatingMenu.appendChild(searchInput);
    floatingMenu.appendChild(postsListContainer);
    document.body.appendChild(floatingMenu);

    /** --- משתנים --- */
    let keyboardNavigationEnabled = true;
    let activePostIndex = -1;
    let currentChatRoot = null;

    /** --- פונקציות עזר --- */
    function isHebrew(text) { return /[\u0590-\u05FF]/.test(text); }
    function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function getCurrentChatRoot() {
        const allChats = document.querySelectorAll('main');
        if (!allChats.length) return null;
        let visibleChat = null;
        allChats.forEach(chat => {
            const rect = chat.getBoundingClientRect();
            if (rect.height > 200 && rect.bottom > 100) visibleChat = chat;
        });
        return visibleChat;
    }

    function getPosts() {
        const chatRoot = getCurrentChatRoot();
        if (!chatRoot) return [];
        const postElements = chatRoot.querySelectorAll('.whitespace-pre-wrap');
        return Array.from(postElements).map((el, index) => {
            const link = el.querySelector('a');
            const text = link ? link.textContent.trim() : el.textContent.trim();
            return { element: el, text, index };
        });
    }

    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        return text.replace(regex, '<span id="highlight">$1</span>');
    }

    function highlightPost(postElement) {
        postElement.style.transition = 'background-color 1.5s ease';
        postElement.style.backgroundColor = 'yellow';
        setTimeout(() => postElement.style.backgroundColor = '', 1500);
    }
let previousPostsJSON = '';

function updatePostsList(focusLast = false) {
    const posts = getPosts();
    const searchTerm = searchInput.value.trim().toLowerCase();
    const filteredPosts = posts.filter(p => p.text.toLowerCase().includes(searchTerm));

    // השוואה למצב קודם
    const currentPostsJSON = JSON.stringify(filteredPosts.map(p => p.text));
    if (currentPostsJSON === previousPostsJSON) return;
    previousPostsJSON = currentPostsJSON;

    // עדכון כותרת
    title.textContent = filteredPosts.length === 0 ? 'לא נמצאו פוסטים' : 'פוסטים';
    const firstChar = title.textContent.trim().charAt(0);
    title.style.direction = isHebrew(firstChar) ? 'rtl' : 'ltr';

    // ניקוי ולבניית רשימה
    postsListContainer.innerHTML = '';
    postsListContainer.classList.toggle('scrollable', filteredPosts.length > 10);

    if (filteredPosts.length === 0) {
        const noResultElement = document.createElement('div');
        noResultElement.textContent = 'לא נמצאו פוסטים';
        noResultElement.style.textAlign = 'center';
        noResultElement.style.opacity = '0.7';
        postsListContainer.appendChild(noResultElement);
    } else {
        filteredPosts.forEach(({ element, text }, i) => {
            const postItem = document.createElement('div');
            postItem.innerHTML = highlightText(text, searchTerm);
            postItem.style.textAlign = isHebrew(text[0]) ? 'right' : 'left';
            postItem.style.direction = isHebrew(text[0]) ? 'rtl' : 'ltr';
            postItem.addEventListener('click', () => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightPost(element);
                activePostIndex = i;
                updateActiveClass(postsListContainer.querySelectorAll('div'));
            });
            postsListContainer.appendChild(postItem);
        });
    }

    activePostIndex = focusLast && filteredPosts.length > 0 ? filteredPosts.length - 1 : 0;
    updateActiveClass(postsListContainer.querySelectorAll('div'));
}

    /** --- עדכון לפי גלילה --- */
    function updateActivePost() {debugger;
        const posts = getPosts();
        const searchTerm = searchInput.value.trim().toLowerCase();
        const filteredPosts = posts.filter(p => p.text.toLowerCase().includes(searchTerm));
        if (!filteredPosts.length) 
            return;

        const viewportMiddle = window.innerHeight / 2;
        let closestIndex = -1;
        let minDistance = Infinity;
        filteredPosts.forEach((p, index) => {
            const rect = p.element.getBoundingClientRect();
            const distance = Math.abs(rect.top + rect.height / 2 - viewportMiddle);
            if (distance < minDistance) { minDistance = distance; closestIndex = index; }
        });
        if (closestIndex === -1) 
            return;
        activePostIndex = closestIndex;
        const postItems = postsListContainer.querySelectorAll('div');
        updateActiveClass(postItems);
    }

    function updateActiveClass(postItems) {
        postItems.forEach((item, index) => {
            item.classList.toggle('active', index === activePostIndex);
            if (index === activePostIndex)
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    /** --- אירועים --- */
    collapseButton.addEventListener('click', () => floatingMenu.classList.toggle('collapsed'));
    closeButton.addEventListener('click', () => floatingMenu.remove());
    searchInput.addEventListener('input', () => updatePostsList());
    window.addEventListener('scroll', updateActivePost);

    keyboardToggleButton.addEventListener('click', () => {
        keyboardNavigationEnabled = !keyboardNavigationEnabled;
        keyboardToggleButton.classList.toggle('on', keyboardNavigationEnabled);
        keyboardToggleButton.classList.toggle('off', !keyboardNavigationEnabled);
    });

    /** --- ניווט מקלדת --- */
    window.addEventListener('keydown', (event) => {
        if (!keyboardNavigationEnabled) return;
        const postItems = postsListContainer.querySelectorAll('div');
        if (!postItems.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activePostIndex = (activePostIndex + 1) % postItems.length;
            updateActiveClass(postItems);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            activePostIndex = (activePostIndex - 1 + postItems.length) % postItems.length;
            updateActiveClass(postItems);
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const posts = getPosts();
            const searchTerm = searchInput.value.trim().toLowerCase();
            const filtered = posts.filter(p => p.text.toLowerCase().includes(searchTerm));
            if (filtered[activePostIndex]) {
                const el = filtered[activePostIndex].element;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightPost(el);
            }
        }
    });

    /** --- גרירה --- */
    let isDragging = false, startX, startY, menuX, menuY;
    header.addEventListener('mousedown', e => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = floatingMenu.getBoundingClientRect();
        menuX = rect.left; menuY = rect.top; e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        let newX = menuX + (e.clientX - startX);
        let newY = menuY + (e.clientY - startY);
        newX = Math.max(0, Math.min(newX, window.innerWidth - floatingMenu.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - floatingMenu.offsetHeight));
        floatingMenu.style.left = newX + 'px';
        floatingMenu.style.top = newY + 'px';
        floatingMenu.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => isDragging = false);

    /** --- האזנה לשינוי צ'אט --- */
    const observer = new MutationObserver(updatePostsList);
    observer.observe(document.body, { childList: true, subtree: true });
    
    /** --- התחלה --- */
    currentChatRoot = getCurrentChatRoot();
    updatePostsList(true);
})();
