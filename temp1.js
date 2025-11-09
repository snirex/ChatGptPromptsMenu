(() => {
    /** --- Styles --- */
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
        #floatingMenuControls > button:not(.keyboard-toggle) {
            cursor: pointer; color: white; margin-left: 6px;
            font-weight: bold; user-select: none;
            background: none; border: none;
            font-size: 16px; line-height: 1; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
        #floatingMenuControls > .keyboard-toggle {
            cursor: pointer; color: white; font-size: 16px;
            line-height: 1; padding: 4px 6px; border-radius: 4px;
            transition: background 0.3s ease; margin-left: 6px;
        }
        #floatingMenuControls > .keyboard-toggle.on { background: #2ecc71; }
        #floatingMenuControls > .keyboard-toggle.off { background: #7f8c8d; }

        #searchInput {
            margin: 3px 10px; padding: 5px 8px; border-radius: 4px;
            border: none; font-size: 14px; width: calc(100% - 20px);
            box-sizing: border-box; direction: rtl;
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
        #floatingMenuList.scrollable { overflow-y: auto; max-height: 380px; }
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

    /** --- DOM Structure --- */
    const floatingMenu = document.createElement('div');
    floatingMenu.id = 'floatingMenu';

    const header = document.createElement('div');
    header.id = 'floatingMenuHeader';

    const title = document.createElement('div');
    title.id = 'floatingMenuTitle';
    title.textContent = document.title;

    const controls = document.createElement('div');
    controls.id = 'floatingMenuControls';

    const collapseButton = document.createElement('button'); collapseButton.textContent = '-';
    const closeButton = document.createElement('button'); closeButton.textContent = '×';
    const keyboardToggleButton = document.createElement('button');
    keyboardToggleButton.textContent = '↕';
    keyboardToggleButton.classList.add('keyboard-toggle', 'on');

    controls.appendChild(collapseButton);
    controls.appendChild(closeButton);
    controls.appendChild(keyboardToggleButton);

    header.appendChild(title);
    header.appendChild(controls);

    const searchInput = document.createElement('input');
    searchInput.id = 'searchInput';
    searchInput.placeholder = 'Search posts...';

    const postsListContainer = document.createElement('div');
    postsListContainer.id = 'floatingMenuList';

    floatingMenu.appendChild(header);
    floatingMenu.appendChild(searchInput);
    floatingMenu.appendChild(postsListContainer);
    document.body.appendChild(floatingMenu);

    /** --- Variables --- */
    let keyboardNavigationEnabled = true;
    let activePostIndex = -1;
    let currentChatRoot = null;
    let currentFilteredPosts = []; // local storage of filtered posts for easier mapping

    /** --- Helper Functions --- */
    function isHebrew(text) { return /[\u0590-\u05FF]/.test(text); }
    function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function debounce(fn, wait = 120) {
        let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    /** --- Detect active chat and extract posts --- */
    function getCurrentChatRoot() {
        const mains = document.querySelectorAll('main');
        if (!mains.length) return null;
        // choose the visible main within viewport
        let visible = null;
        mains.forEach(m => {
            const r = m.getBoundingClientRect();
            if (r.height > 80 && r.bottom > 50 && r.top < window.innerHeight) visible = m;
        });
        return visible;
    }

    function getPostsFromChatRoot(chatRoot) {
        if (!chatRoot) return [];
        const postElements = chatRoot.querySelectorAll('.whitespace-pre-wrap');
        return Array.from(postElements).map((el, index) => {
            const link = el.querySelector('a');
            const text = link ? link.textContent.trim() : el.textContent.trim();
            return { element: el, text, index };
        });
    }

    /** --- Highlighting and Searching --- */
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        return text.replace(regex, '<span id="highlight">$1</span>');
    }
    function highlightPost(postElement) {
        postElement.style.transition = 'background-color 1.2s ease';
        postElement.style.backgroundColor = 'yellow';
        setTimeout(() => postElement.style.backgroundColor = '', 1200);
    }

    /** --- Build post list inside menu --- */
    function rebuildList(focusLast = false) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const allPosts = getPostsFromChatRoot(currentChatRoot);
        const filtered = allPosts.filter(p => p.text.toLowerCase().includes(searchTerm));

        currentFilteredPosts = filtered; // store for later usage

        postsListContainer.classList.add('fade');
        setTimeout(() => {
            postsListContainer.innerHTML = '';
            postsListContainer.classList.toggle('scrollable', filtered.length > 10);

            if (!filtered.length) {
                const noResult = document.createElement('div');
                noResult.textContent = 'No posts found';
                noResult.style.textAlign = 'center'; noResult.style.opacity = '0.7';
                postsListContainer.appendChild(noResult);
            } else {
                filtered.forEach((p, i) => {
                    const postItem = document.createElement('div');
                    postItem.innerHTML = highlightText(p.text, searchTerm);
                    postItem.style.textAlign = isHebrew(p.text[0]) ? 'right' : 'left';
                    postItem.style.direction = isHebrew(p.text[0]) ? 'rtl' : 'ltr';

                    // click on list item = scroll to post and set as active
                    postItem.addEventListener('click', () => {
                        p.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        highlightPost(p.element);
                        activePostIndex = i;
                        updateActiveClass();
                    });

                    postsListContainer.appendChild(postItem);
                });
            }

            activePostIndex = (focusLast && filtered.length > 0) ? filtered.length - 1 : 0;
            updateActiveClass();
        }, 80);
        setTimeout(() => postsListContainer.classList.remove('fade'), 200);
    }

    /** --- Update active class based on activePostIndex --- */
    function updateActiveClass() {
        const items = postsListContainer.querySelectorAll('div');
        items.forEach((it, idx) => it.classList.toggle('active', idx === activePostIndex));
        // smooth internal scroll within menu
        const activeItem = items[activePostIndex];
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /** --- Detect element in screen center --- */
    let io = null;
    function setupIntersectionObserver() {
        if (io) io.disconnect();
        io = new IntersectionObserver(entries => {
            // find post with highest intersectionRatio (closest to center)
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            if (!visible.length) return;

            const topEntry = visible[0];
            const el = topEntry.target;
            // find its position in filtered list (currentFilteredPosts)
            const idx = currentFilteredPosts.findIndex(p => p.element === el);
            if (idx !== -1 && idx !== activePostIndex) {
                activePostIndex = idx;
                updateActiveClass();
            }
        }, {
            root: null,
            rootMargin: '-30% 0% -30% 0%', // detection area around center
            threshold: [0, 0.25, 0.5, 0.75, 1]
        });

        // observe relevant elements
        if (currentFilteredPosts && currentFilteredPosts.length) {
            currentFilteredPosts.forEach(p => io.observe(p.element));
        }
    }

    /** --- Add click listeners to posts (including dynamic changes) --- */
    function attachClickListenersToPosts() {
        const posts = getPostsFromChatRoot(currentChatRoot);
        posts.forEach(p => {
            // avoid multiple listeners
            if (!p.element.__hasMenuListener) {
                p.element.__hasMenuListener = true;
                p.element.addEventListener('click', () => {
                    // find position in currentFilteredPosts
                    const idx = currentFilteredPosts.findIndex(x => x.element === p.element);
                    if (idx !== -1) {
                        activePostIndex = idx;
                        updateActiveClass();
                    } else {
                        // if not found - rebuild list
                        rebuildList(false);
                    }
                });
            }
        });
    }

    /** --- update by scroll --- */
    const debouncedUpdateActivePost = debounce(() => {
        // rely on IntersectionObserver; fallback by distance from center
        if (!currentFilteredPosts || !currentFilteredPosts.length) return;
        const viewportMiddle = window.innerHeight / 2;
        let closestIndex = -1, minDistance = Infinity;
        currentFilteredPosts.forEach((p, idx) => {
            const rect = p.element.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const dist = Math.abs(center - viewportMiddle);
            if (dist < minDistance) { minDistance = dist; closestIndex = idx; }
        });
        if (closestIndex !== -1 && closestIndex !== activePostIndex) {
            activePostIndex = closestIndex;
            updateActiveClass();
        }
    }, 80);

    window.addEventListener('scroll', debouncedUpdateActivePost, { passive: true });

    /** --- Global events --- */
    collapseButton.addEventListener('click', () => floatingMenu.classList.toggle('collapsed'));
    closeButton.addEventListener('click', () => floatingMenu.remove());
    searchInput.addEventListener('input', debounce(() => {
        rebuildList(false);
        // after rebuild re-init IO and listeners
        setupIntersectionObserver();
        attachClickListenersToPosts();
    }, 120));

    keyboardToggleButton.addEventListener('click', () => {
        keyboardNavigationEnabled = !keyboardNavigationEnabled;
        keyboardToggleButton.classList.toggle('on', keyboardNavigationEnabled);
        keyboardToggleButton.classList.toggle('off', !keyboardNavigationEnabled);
    });

    window.addEventListener('keydown', (event) => {
        if (!keyboardNavigationEnabled) return;
        const items = postsListContainer.querySelectorAll('div');
        if (!items.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activePostIndex = Math.min(items.length - 1, (activePostIndex + 1));
            updateActiveClass();
            // scroll to post
            if (currentFilteredPosts[activePostIndex]) {
                currentFilteredPosts[activePostIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            activePostIndex = Math.max(0, (activePostIndex - 1));
            updateActiveClass();
            if (currentFilteredPosts[activePostIndex]) {
                currentFilteredPosts[activePostIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (currentFilteredPosts[activePostIndex]) {
                currentFilteredPosts[activePostIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightPost(currentFilteredPosts[activePostIndex].element);
            }
        }
    });

    /** --- Drag --- */
    let isDragging = false, startX, startY, menuX, menuY;
    header.addEventListener('mousedown', e => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = floatingMenu.getBoundingClientRect(); menuX = rect.left; menuY = rect.top; e.preventDefault();
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

    /** --- MutationObserver for changing chats --- */
    const mutationHandler = debounce((mutations) => {
        const newChatRoot = getCurrentChatRoot();
        if (newChatRoot !== currentChatRoot) {
            currentChatRoot = newChatRoot;
            // wait briefly before rebuild to allow dynamic loading
            setTimeout(() => {
                rebuildList(true);
                attachClickListenersToPosts();
                setupIntersectionObserver();
            }, 200);
            return;
        }
        // if same chat - check if posts changed -> refresh list
        let postsChanged = false;
        for (const m of mutations) {
            if (m.type === 'childList') {
                // detect added/removed elements with class whitespace-pre-wrap
                const addedOrRemoved = [...m.addedNodes, ...m.removedNodes].some(n => {
                    if (!(n instanceof Element)) return false;
                    return n.matches && n.matches('.whitespace-pre-wrap') || n.querySelector && n.querySelector('.whitespace-pre-wrap');
                });
                if (addedOrRemoved) { postsChanged = true; break; }
            }
            if (m.type === 'attributes' && m.target && m.target.classList && m.target.classList.contains('whitespace-pre-wrap')) {
                postsChanged = true; break;
            }
        }
        if (postsChanged) {
            // update when posts change
            rebuildList(false);
            attachClickListenersToPosts();
            setupIntersectionObserver();
        }
    }, 220);

    const globalObserver = new MutationObserver(mutationHandler);
    globalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    /** --- Init --- */
    currentChatRoot = getCurrentChatRoot();
    rebuildList(true);
    attachClickListenersToPosts();
    setupIntersectionObserver();

    // ensure refresh when system loads slowly
    window.addEventListener('load', () => {
        setTimeout(() => {
            currentChatRoot = getCurrentChatRoot();
            rebuildList(true);
            attachClickListenersToPosts();
            setupIntersectionObserver();
        }, 300);
    });
})();
