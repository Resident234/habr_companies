(function(){
    // ====== CONFIG: image sources & alt text (mirror items in DOM ordering) ======
    const IMAGES = [
      { src: 'assets/img/square/1.jpg', alt:'Design shot 1' },
      { src: 'assets/img/square/2.jpg', alt:'Branding shot 1' },
      { src: 'assets/img/square/3.jpg', alt:'Web shot 1' },
      { src: 'assets/img/square/4.jpg', alt:'Design shot 2' },
      { src: 'assets/img/square/5.jpg', alt:'Branding shot 2' },
      { src: 'assets/img/square/6.jpg', alt:'Web shot 2' }
    ];

    // ====== Elements ======
    const gridEl = document.getElementById('kb-grid');
    const horizontalEl = document.getElementById('kb-horizontal');
    const swiperWrap = document.getElementById('kb-swiper-wrap');
    const swiperWrapper = swiperWrap.querySelector('.swiper-wrapper');
    const lightbox = document.getElementById('kb-lightbox');
    const lbImg = lightbox.querySelector('.lb-img');
    const lbClose = lightbox.querySelector('.lb-close');
    const lbArrows = lightbox.querySelectorAll('.lb-arrow');

    // ====== Helper: current filtered list (DOM nodes) ======
    function getFilteredNodes(cat){
      const nodes = Array.from(gridEl.querySelectorAll('.gallery-item'));
      if(!cat || cat === 'all') return nodes;
      return nodes.filter(n => (n.getAttribute('data-category')||'').toLowerCase() === cat.toLowerCase());
    }

    // ====== Filter buttons ======
    document.querySelectorAll('.kb-filter').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const cat = btn.dataset.cat;
        document.querySelectorAll('.kb-filter').forEach(b=>b.classList.remove('bg-brand-500/10','text-brand-200'));
        btn.classList.add('bg-brand-500/10','text-brand-200');
        applyFilter(cat);
      });
    });
    // set default active filter = all
    document.querySelector('.kb-filter[data-cat="all"]').classList.add('bg-brand-500/10','text-brand-200');

    function applyFilter(cat){
      // show/hide items in grid
      const nodes = Array.from(gridEl.querySelectorAll('.gallery-item'));
      nodes.forEach(n=>{
        const matches = (cat==='all' || !cat) ? true : n.getAttribute('data-category') === cat;
        n.style.display = matches ? '' : 'none';
      });
      // update horizontal & swiper if visible
      if(!horizontalEl.classList.contains('kb-hide')) populateHorizontal(cat);
      if(!swiperWrap.classList.contains('kb-hide')) populateSwiper(cat);
    }

    // ====== Mode toggle (grid / horizontal / slider) ======
    function showMode(mode){
      // reset displays
      gridEl.style.display = 'none';
      horizontalEl.style.display = 'none';
      swiperWrap.style.display = 'none';
      gridEl.classList.remove('kb-hide');
      horizontalEl.classList.add('kb-hide');
      swiperWrap.classList.add('kb-hide');

      if(mode === 'grid'){
        gridEl.style.display = '';
      } else if(mode === 'horizontal'){
        populateHorizontal(currentFilter);
        horizontalEl.style.display = '';
        horizontalEl.classList.remove('kb-hide');
      } else if(mode === 'slider'){
        populateSwiper(currentFilter);
        swiperWrap.style.display = '';
        swiperWrap.classList.remove('kb-hide');
        initSwiperOnce();
      }
      // update mode buttons visual
      document.querySelectorAll('.kb-mode').forEach(b=> b.classList.remove('bg-brand-500/10','text-brand-200'));
      document.querySelector('.kb-mode[data-mode="'+mode+'"]').classList.add('bg-brand-500/10','text-brand-200');
    }

    document.querySelectorAll('.kb-mode').forEach(btn=>{
      btn.addEventListener('click', ()=> showMode(btn.dataset.mode));
    });

    // default
    let currentFilter = 'all';
    showMode('grid');

    // ====== Populate horizontal mode ======
    function populateHorizontal(cat){
      currentFilter = cat || currentFilter;
      horizontalEl.innerHTML = ''; // clear
      const nodes = getFilteredNodes(cat);
      nodes.forEach((node, idx) => {
        // clone original node to horizontal container
        const clone = node.cloneNode(true);
        // ensure open-lightbox has proper index (global index in IMAGES)
        const originalIndex = parseInt(clone.querySelector('.open-lightbox').dataset.index,10);
        clone.querySelector('.open-lightbox').dataset.index = originalIndex;
        horizontalEl.appendChild(clone);
      });
      // init drag-to-scroll for horizontal
      enableDragScroll(horizontalEl);
    }

    // ====== Populate Swiper mode ======
    let swiperInstance = null;
    function populateSwiper(cat){
      swiperWrapper.innerHTML = '';
      const nodes = getFilteredNodes(cat);
      nodes.forEach(node=>{
        const idx = parseInt(node.querySelector('.open-lightbox').dataset.index,10);
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = '<img src="'+IMAGES[idx].src+'" alt="'+IMAGES[idx].alt+'">';
        swiperWrapper.appendChild(slide);
      });
      // destroy existing instance if present
      if(swiperInstance){ try { swiperInstance.destroy(true,true); } catch(e){} swiperInstance = null; }
      // init again
      initSwiperOnce();
    }

    function initSwiperOnce(){
      if(swiperInstance) return;
      swiperInstance = new Swiper('.mySwiper', {
        loop: false,
        slidesPerView: 1,
        spaceBetween: 16,
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: { 768: { slidesPerView: 1.2 }, 1024: { slidesPerView: 1.5 } }
      });
    }

    // ====== Lightbox functionality ======
    let currentIndex = 0;
    function openLightbox(idx){
      currentIndex = Number(idx);
      lbImg.src = IMAGES[currentIndex].src;
      lbImg.alt = IMAGES[currentIndex].alt || '';
      lightbox.style.display = 'flex';
      lightbox.classList.remove('kb-hide');
      document.body.style.overflow = 'hidden';
      lbImg.focus && lbImg.focus();
    }
    function closeLightbox(){
      lightbox.style.display = 'none';
      lightbox.classList.add('kb-hide');
      document.body.style.overflow = '';
      lbImg.src = '';
    }
    function showNext(dir){
      const total = IMAGES.length;
      currentIndex = (currentIndex + dir + total) % total;
      lbImg.src = IMAGES[currentIndex].src;
      lbImg.alt = IMAGES[currentIndex].alt || '';
    }

    // attach open-lightbox click handlers (delegated)
    document.addEventListener('click', function(e){
      const openBtn = e.target.closest('.open-lightbox');
      if(openBtn){
        e.preventDefault();
        const idx = openBtn.dataset.index;
        openLightbox(idx);
      }
    });
    // close handlers
    lbClose.addEventListener('click', closeLightbox);
    lbArrows.forEach(a=> a.addEventListener('click', ()=> showNext(Number(a.dataset.dir))));
    document.addEventListener('keydown', (e)=> {
      if(lightbox.style.display !== 'none'){
        if(e.key === 'Escape') closeLightbox();
        if(e.key === 'ArrowRight') showNext(1);
        if(e.key === 'ArrowLeft') showNext(-1);
      }
    });

    // ====== Drag-to-scroll for horizontal ======
    function enableDragScroll(el){
      let isDown=false, startX, scrollLeft;
      el.addEventListener('mousedown', (e)=>{
        isDown=true; el.classList.add('active'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
      });
      window.addEventListener('mouseup', ()=> { isDown=false; el.classList.remove('active'); });
      el.addEventListener('mousemove', (e)=>{
        if(!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.2;
        el.scrollLeft = scrollLeft - walk;
      });
      // also allow wheel to horizontal scroll
      el.addEventListener('wheel', (ev)=>{
        if(Math.abs(ev.deltaX) < Math.abs(ev.deltaY)){
          ev.preventDefault();
          el.scrollLeft += ev.deltaY;
        }
      }, { passive: false });
    }

    // ====== GSAP animate on enter (grid items) ======
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('#kb-grid .gallery-item').forEach((el, i) => {
      gsap.fromTo(el, { autoAlpha: 0, y: 20, scale:0.98 }, {
        autoAlpha: 1, y:0, scale:1, duration: .7, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
      });
    });

    // ====== Keyboard-focus support for open-lightbox buttons ======
    document.querySelectorAll('.open-lightbox').forEach(btn=>{
      btn.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(btn.dataset.index); }
      });
    });

    // ====== Ensure horizontal & swiper are built from original grid when toggled ======
    // Build initial horizontal and swiper contents (but hidden)
    populateHorizontal('all');
    populateSwiper('all');

  })();