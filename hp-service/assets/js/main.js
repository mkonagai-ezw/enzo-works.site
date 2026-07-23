// EnzoWorks サービスサイト — shared behaviour

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Header scroll style ---------- */
  const header = document.getElementById('site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 12) {
        header.classList.add('bg-white/95', 'shadow-md', 'backdrop-blur');
        header.classList.remove('bg-transparent');
      } else if (header.dataset.transparentHero === 'true') {
        header.classList.remove('bg-white/95', 'shadow-md', 'backdrop-blur');
        header.classList.add('bg-transparent');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile nav toggle ---------- */
  const menuBtn = document.getElementById('menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const menuIconOpen = document.getElementById('icon-open');
  const menuIconClose = document.getElementById('icon-close');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (menuIconOpen && menuIconClose) {
        menuIconOpen.classList.toggle('hidden', isOpen);
        menuIconClose.classList.toggle('hidden', !isOpen);
      }
    });
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        if (menuIconOpen && menuIconClose) {
          menuIconOpen.classList.remove('hidden');
          menuIconClose.classList.add('hidden');
        }
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Contact form (Web3Forms submission + bot protection) ---------- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    // ボット対策: フォーム表示から一定時間内の送信はbotとみなして拒否する（人間はまず読んでから入力するため）
    const formShownAt = Date.now();
    const MIN_FILL_TIME_MS = 3000;

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('[type="submit"]');
      const feedback = document.getElementById('form-feedback');
      const errorBox = document.getElementById('form-error');
      const btnLabel = submitBtn.querySelector('.btn-label');
      const btnSpinner = submitBtn.querySelector('.spinner');

      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }

      // ハニーポット: 隠しチェックボックスが埋まっていればbotとみなし、何も起きていないように見せて中断する
      const honeypot = contactForm.querySelector('input[name="botcheck"]');
      if (honeypot && honeypot.checked) {
        return;
      }
      // 時間トラップ: 表示直後の即時送信はbotとみなして中断する
      if (Date.now() - formShownAt < MIN_FILL_TIME_MS) {
        return;
      }

      const hideBoxes = () => {
        [feedback, errorBox].forEach((box) => {
          if (!box) return;
          box.classList.add('hidden');
          box.classList.remove('flex');
        });
      };

      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
      if (btnLabel) btnLabel.textContent = '送信中...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');
      hideBoxes();

      try {
        const formData = new FormData(contactForm);
        const payload = Object.fromEntries(formData);
        delete payload.botcheck;

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (response.status === 200 && result.success) {
          contactForm.reset();
          if (feedback) {
            feedback.classList.remove('hidden');
            feedback.classList.add('flex');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          throw new Error(result.message || 'submission failed');
        }
      } catch (err) {
        if (errorBox) {
          errorBox.classList.remove('hidden');
          errorBox.classList.add('flex');
          errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
        if (btnLabel) btnLabel.textContent = '無料相談・お申込みを送信する';
        if (btnSpinner) btnSpinner.classList.add('hidden');
      }
    });
  }
});
