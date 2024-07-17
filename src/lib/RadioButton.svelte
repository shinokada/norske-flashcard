<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	interface Props {
		label: string;
		name: string;
		value: string;
		inputClass?: string;
		labelClass?: string;
	}

	let { label, name, value, inputClass, labelClass, ...attributes }: Props = $props();
	let inputCls =
		'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600';
	let labelCls = 'ms-2 text-sm font-medium text-gray-900 dark:text-gray-300';
	let iCls = twMerge(inputCls, inputClass);
	let lCls = twMerge(labelCls, labelClass);
</script>

<div class="mb-4 flex items-center">
	<input type="radio" {value} {name} {...attributes} class={iCls} />
	<label for={name} class={lCls}>{label}</label>
</div>
