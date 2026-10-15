<script>
  import * as m from '$lib/paraglide/messages.js';
  import { ChevronDownOutline } from 'flowbite-svelte-icons';

  const faqs = [
    {
      id: 1,
      question: m.guide_faq_freeplus_q(),
      answer: m.guide_faq_freeplus_a_v2(),
      cta: {
        href: '/plus',
        text: m.guide_faq_freeplus_cta()
      }
    },
    {
      id: 2,
      question: m.guide_faq_norskproven_q(),
      answer: m.guide_faq_norskproven_a()
    },
    {
      id: 3,
      question: m.guide_faq_reminder_q(),
      answer: m.guide_faq_reminder_a()
    },
    {
      id: 4,
      question: m.guide_faq_no_reminder_q(),
      answer: m.guide_faq_no_reminder_a()
    },
    {
      id: 5,
      question: m.guide_faq_emails_q(),
      answer: m.guide_faq_emails_a()
    },
    {
      id: 6,
      question: m.guide_faq_sync_q(),
      answer: m.guide_faq_sync_a(),
      cta: {
        href: '/plus',
        text: m.guide_faq_sync_cta()
      }
    },
    {
      id: 7,
      question: m.guide_faq_offline_q(),
      answer: m.guide_faq_offline_a()
    },
    {
      id: 8,
      question: m.guide_faq_prefs_q(),
      answer: m.guide_faq_prefs_a()
    },
    {
      id: 9,
      question: m.guide_faq_intensity_q(),
      answer: m.guide_faq_intensity_a()
    },
    {
      id: 10,
      question: m.guide_faq_download_q(),
      answer: m.guide_faq_download_a(),
      badge: m.faq_badge_plus()
    },
    {
      id: 11,
      question: m.guide_faq_uttrykk_q(),
      answer: m.guide_faq_uttrykk_a()
    },
    {
      id: 12,
      question: m.guide_faq_contact_q(),
      answer: m.guide_faq_contact_a(),
      cta: {
        href: '/contact',
        text: m.nav_contact()
      }
    }
  ];
</script>

<div class="mx-auto max-w-3xl px-4 py-10 text-left">
  <h1 class="mb-2">{m.guide_faq_heading()}</h1>
  <p class="mb-10 text-gray-600 dark:text-gray-300">
    {m.faq_page_subtitle()}
  </p>

  <div class="divide-y divide-gray-200 dark:divide-gray-700">
    {#each faqs as faq, i (faq.id)}
      <details class="group py-4" open={i === 0}>
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-800 marker:content-none dark:text-gray-100"
        >
          <span>{faq.question}</span>
          <ChevronDownOutline
            class="h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-180 dark:text-gray-400"
          />
        </summary>

        <p class="mt-3 text-base text-gray-600 dark:text-gray-300">
          {faq.answer}

          {#if faq.cta}
            <a href={faq.cta.href} class="underline">
              {faq.cta.text}
            </a>
          {/if}

          {#if faq.badge}
            <span
              class="ml-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
            >
              {faq.badge}
            </span>
          {/if}
        </p>
      </details>
    {/each}
  </div>
</div>
