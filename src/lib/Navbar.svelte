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

  const linkStyle = 'block py-2 px-3 text-lg hover:underline text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-700 md:p-0 dark:text-white md:dark:hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent'
  const activeStyle = 'block py-2 px-3 text-lg hover:underline text-white bg-blue-700 rounded md:bg-transparent md:text-blue-700 md:p-0 dark:text-white md:dark:text-blue-500'
</script>

<nav class="bg-transparent border-gray-200 dark:bg-gray-900">
  <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
    <a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
      <No size={30} class="display: inline"/> 
        <span class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">Norsk Flashcard</span>
    </a>
    <button onclick={toggleNav} type="button" class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-controls="navbar-default">
        <span class="sr-only">Open main menu</span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
        </svg>
    </button>
    <div class="{navClass} w-full md:block md:w-auto" id="navbar-default">
      <ul class="font-medium flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 bg-transparent dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
        <li>
          <a href="/" onclick={closeNav} aria-current={$page.url.pathname === '/'} class="{$page.url.pathname === '/' ? activeStyle : linkStyle}">Nivå A1</a>
        </li>
        <li>
          <a href="/a2" onclick={closeNav} aria-current={$page.url.pathname === '/a2'} class="{$page.url.pathname === '/a2' ? activeStyle : linkStyle}">Nivå A2</a>
        </li>
        <li>
          <a href="/credits" onclick={closeNav} aria-current={$page.url.pathname === '/credits'} class="{$page.url.pathname === '/credits' ? activeStyle : linkStyle}">Credits</a>
        </li>
        <li>
          <a href="https://gjett-norsk.vercel.app" target="_blank" class="{linkStyle} text-red-500">Gjett Norsk</a>
        </li>
      </ul>
    </div>
  </div>

</nav>

