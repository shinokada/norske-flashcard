<script>
  import No from './No.svelte'
  import { page, navigating } from '$app/stores';
  let navStatus  = $state(false)
  let navClass = $derived(
    navStatus ? 'block':'hidden'
  )

  const toggleNav = ()=>{
    // console.log('clicked')
    navStatus = !navStatus
    // console.log('navStatus', navStatus)
  }

  const closeNav = ()=>{
    navStatus = false
  }

  const linkStyle = 'block py-2 px-3 text-md hover:underline text-gray-900 rounded hover:bg-gray-100 lg:hover:bg-transparent lg:border-0 lg:hover:text-blue-700 lg:p-0 dark:text-white lg:dark:hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-white lg:dark:hover:bg-transparent'
  const activeStyle = 'block py-2 px-3 text-md hover:underline text-white bg-blue-700 rounded lg:bg-transparent lg:text-blue-700 lg:p-0 dark:text-white lg:dark:text-blue-500'
</script>

<nav class="bg-transparent border-gray-200 dark:bg-gray-900">
  <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
    <a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
      <No size={30} class="display: inline"/> 
        <span class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white">Norske Flashcard</span>
    </a>
    <button onclick={toggleNav} type="button" class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-controls="navbar-default">
        <span class="sr-only">Open main menu</span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
        </svg>
    </button>
    <div class="{navClass} w-full lg:block lg:w-auto" id="navbar-default">
      <ul class="font-medium flex flex-col p-4 lg:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 lg:flex-row lg:space-x-8 rtl:space-x-reverse lg:mt-0 lg:border-0 bg-transparent dark:bg-gray-800 lg:dark:bg-gray-900 dark:border-gray-700">
        <li>
          <a href="/" onclick={closeNav} aria-current={$page.url.pathname === '/'} class="{$page.url.pathname === '/' ? activeStyle : linkStyle}">Nivå A1</a>
        </li>
        <li>
          <a href="/a2" onclick={closeNav} aria-current={$page.url.pathname === '/a2'} class="{$page.url.pathname === '/a2' ? activeStyle : linkStyle}">Nivå A2</a>
        </li>
        <li>
          <a href="/verbs" onclick={closeNav} aria-current={$page.url.pathname === '/verbs'} class="{$page.url.pathname === '/verbs' ? activeStyle : linkStyle}">Verbs</a>
        </li>
        <li>
          <a href="/adjectives" onclick={closeNav} aria-current={$page.url.pathname === '/adjectives'} class="{$page.url.pathname === '/adjectives' ? activeStyle : linkStyle}">Adjectives</a>
        </li>
        <li>
          <a href="/vocab" onclick={closeNav} aria-current={$page.url.pathname === '/vocab'} class="{$page.url.pathname === '/vocab' ? activeStyle : linkStyle}">Vocab</a>
        </li>
        <li>
          <a href="/education" onclick={closeNav} aria-current={$page.url.pathname === '/education'} class="{$page.url.pathname === '/education' ? activeStyle : linkStyle}">Education</a>
        </li>
        <li>
          <a href="/credits" onclick={closeNav} aria-current={$page.url.pathname === '/credits'} class="{$page.url.pathname === '/credits' ? activeStyle : linkStyle}">Credits</a>
        </li>
      </ul>
    </div>
  </div>

</nav>

