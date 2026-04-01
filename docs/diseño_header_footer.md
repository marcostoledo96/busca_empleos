<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>OFFER_RECAP_V1 // JOB_SEARCH_DASHBOARD</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=JetBrains+Mono:wght@400;700&amp;family=Work+Sans:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#ffdad7",
                        "surface-dim": "#dadada",
                        "on-tertiary": "#ffdad7",
                        "on-surface-variant": "#474747",
                        "on-primary-fixed": "#ffffff",
                        "primary-container": "#3b3b3b",
                        "primary-fixed-dim": "#474747",
                        "tertiary": "#7d000f",
                        "outline-variant": "#c6c6c6",
                        "outline": "#777777",
                        "on-secondary-container": "#002113",
                        "secondary-fixed-dim": "#26c289",
                        "surface-container-lowest": "#ffffff",
                        "primary-fixed": "#5e5e5e",
                        "on-error": "#ffffff",
                        "inverse-surface": "#2f3131",
                        "surface-container-low": "#f3f3f3",
                        "secondary-fixed": "#4edea3",
                        "on-background": "#1a1c1c",
                        "inverse-on-surface": "#f0f1f1",
                        "surface-bright": "#f9f9f9",
                        "on-primary-fixed-variant": "#e2e2e2",
                        "error": "#ba1a1a",
                        "inverse-primary": "#c6c6c6",
                        "surface-container-highest": "#e2e2e2",
                        "surface-variant": "#e2e2e2",
                        "primary": "#000000",
                        "tertiary-fixed": "#b91a24",
                        "on-tertiary-fixed": "#ffffff",
                        "secondary": "#10B981",
                        "on-secondary-fixed": "#002113",
                        "surface-container": "#eeeeee",
                        "background": "#f9f9f9",
                        "tertiary-fixed-dim": "#930013",
                        "secondary-container": "#5fedb0",
                        "on-secondary": "#ffffff",
                        "on-secondary-fixed-variant": "#00452d",
                        "surface-container-high": "#e8e8e8",
                        "surface-tint": "#5e5e5e",
                        "tertiary-container": "#da3437",
                        "on-primary-container": "#ffffff",
                        "on-primary": "#e2e2e2",
                        "on-surface": "#1a1c1c",
                        "error-container": "#ffdad6",
                        "surface": "#f9f9f9",
                        "on-tertiary-container": "#ffffff",
                        "on-error-container": "#410002"
                    },
                    fontFamily: {
                        "headline": ["Space Grotesk"],
                        "body": ["Work Sans"],
                        "label": ["Space Grotesk"],
                        "mono": ["JetBrains Mono"]
                    },
                    borderRadius: {"DEFAULT": "0px", "lg": "0px", "xl": "0px", "full": "9999px"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        body { font-family: 'Work Sans', sans-serif; background-color: #FAFAFA; color: #000000; }
        .carriage-return-border { border-left: 2px solid #000; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f9f9f9; }
        ::-webkit-scrollbar-thumb { background: #000; }
    </style>
</head>
<body class="overflow-hidden">
<div class="flex h-screen bg-surface">
<!-- SideNavBar (The Anchor) -->
<aside class="flex flex-col h-full bg-white dark:bg-black font-['JetBrains_Mono'] uppercase text-sm h-screen border-r border-black dark:border-white w-64 shrink-0 overflow-y-auto">
<div class="font-['Space_Grotesk'] font-black text-2xl px-4 py-8 tracking-tighter">
                CARRIAGE_RETURN
                <div class="text-[10px] font-normal tracking-widest mt-1 opacity-60">ID: 8829-XJ</div>
</div>
<nav class="flex-grow">
<ul class="flex flex-col">
<li class="bg-black text-white dark:bg-white dark:text-black font-bold p-4 cursor-crosshair transition-none flex items-center gap-3">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>DASHBOARD</span>
</li>
<li class="text-black dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-crosshair transition-none flex items-center gap-3">
<span class="material-symbols-outlined" data-icon="terminal">terminal</span>
<span>LIVE_FEED</span>
</li>
<li class="text-black dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-crosshair transition-none flex items-center gap-3">
<span class="material-symbols-outlined" data-icon="assignment">assignment</span>
<span>APPLICATIONS</span>
</li>
<li class="text-black dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-crosshair transition-none flex items-center gap-3">
<span class="material-symbols-outlined" data-icon="inventory_2">inventory_2</span>
<span>ARCHIVE</span>
</li>
<li class="text-black dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-crosshair transition-none flex items-center gap-3">
<span class="material-symbols-outlined" data-icon="tune">tune</span>
<span>SETTINGS</span>
</li>
</ul>
</nav>
<div class="p-4 mt-auto">
<button class="w-full py-3 border border-black font-bold tracking-tighter hover:bg-black hover:text-white transition-colors duration-75">
                    [ NEW_SEARCH ]
                </button>
</div>
<div class="mt-4 border-t border-black p-4 flex items-center gap-3 hover:bg-zinc-100 cursor-pointer">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
<span>LOGOUT</span>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-grow flex flex-col min-w-0">
<!-- TopAppBar (Offer Recap) -->
<header class="flex justify-between items-center w-full px-6 py-4 bg-white dark:bg-black border-b-2 border-black dark:border-white shrink-0">
<div class="flex items-center gap-6">
<div class="font-['Space_Grotesk'] font-bold tracking-tight uppercase text-black dark:text-white text-xl tracking-tighter">
                        OFFER_RECAP_V1
                    </div>
<div class="hidden md:flex items-center gap-4 text-xs font-mono opacity-50">
<span class="flex items-center gap-1"><span class="w-2 h-2 bg-secondary"></span> SYSTEM_ACTIVE</span>
<span>|</span>
<span>REGION: US-EAST-1</span>
</div>
</div>
<div class="flex items-center gap-4">
<div class="flex gap-2">
<button class="p-2 hover:bg-black hover:text-white transition-colors duration-75 active:invert scale-95"><span class="material-symbols-outlined" data-icon="settings">settings</span></button>
<button class="p-2 hover:bg-black hover:text-white transition-colors duration-75 active:invert scale-95"><span class="material-symbols-outlined" data-icon="sync">sync</span></button>
<button class="p-2 hover:bg-black hover:text-white transition-colors duration-75 active:invert scale-95"><span class="material-symbols-outlined" data-icon="power_settings_new">power_settings_new</span></button>
</div>
</div>
</header>
<!-- Scrollable Body -->
<div class="flex-grow overflow-y-auto p-10 pb-24">
<!-- Main Header Cluster -->
<div class="mb-16">
<h1 class="font-['Space_Grotesk'] font-bold text-6xl tracking-tight uppercase border-l-8 border-black pl-8 mb-4">
                        OFFER_MATRIX_BETA
                    </h1>
<div class="flex items-baseline gap-8 font-['JetBrains_Mono'] uppercase tracking-widest text-sm ml-10">
<div class="flex flex-col">
<span class="text-xs opacity-50">Pending_Total</span>
<span class="text-2xl font-bold">342</span>
</div>
<div class="flex flex-col">
<span class="text-xs opacity-50 text-secondary">Approved_Sync</span>
<span class="text-2xl font-bold text-secondary">12</span>
</div>
<div class="flex flex-col">
<span class="text-xs opacity-50 text-tertiary">Rejected_Null</span>
<span class="text-2xl font-bold text-tertiary">89</span>
</div>
</div>
</div>
<!-- Table View -->
<div class="bg-white border-2 border-black">
<table class="w-full text-left border-collapse">
<thead>
<tr class="border-b-2 border-black font-['Space_Grotesk'] uppercase font-bold text-xs tracking-widest bg-zinc-50">
<th class="p-4 border-r border-black w-24">MATCH_%</th>
<th class="p-4 border-r border-black">JOB_TITLE</th>
<th class="p-4 border-r border-black">COMPANY</th>
<th class="p-4 border-r border-black">LOCATION</th>
<th class="p-4 border-r border-black">IA_REASONING</th>
<th class="p-4 text-center">ACTIONS</th>
</tr>
</thead>
<tbody class="font-['Work_Sans']">
<!-- Row 1 -->
<tr class="border-b border-black hover:bg-zinc-50 transition-colors">
<td class="p-4 border-r border-black font-['JetBrains_Mono'] font-bold text-lg text-secondary">98.2</td>
<td class="p-4 border-r border-black font-medium uppercase text-sm">Sr. Systems Architect</td>
<td class="p-4 border-r border-black font-mono text-sm">NEURAL_NET_INC</td>
<td class="p-4 border-r border-black text-xs opacity-70">San Francisco, CA</td>
<td class="p-4 border-r border-black">
<div class="bg-zinc-100 p-2 font-mono text-[10px] leading-tight border-l-2 border-black">
                                        STACK_MATCH: RUST, K8S, GRPC.<br/>
                                        HISTORICAL_ALIGNMENT: 0.94<br/>
                                        SENTIMENT: AGGRESSIVE_HIRE
                                    </div>
</td>
<td class="p-4">
<div class="flex justify-center gap-2 font-['JetBrains_Mono'] text-[10px] font-bold">
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[VIEW]</button>
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[POST]</button>
<button class="px-2 py-1 border border-black hover:bg-tertiary hover:text-white">[DISCARD]</button>
</div>
</td>
</tr>
<!-- Row 2 -->
<tr class="border-b border-black hover:bg-zinc-50 transition-colors">
<td class="p-4 border-r border-black font-['JetBrains_Mono'] font-bold text-lg text-secondary">94.7</td>
<td class="p-4 border-r border-black font-medium uppercase text-sm">Lead DevOps Engineer</td>
<td class="p-4 border-r border-black font-mono text-sm">CYBER_DYNE_SYSTEMS</td>
<td class="p-4 border-r border-black text-xs opacity-70">Remote / Austin</td>
<td class="p-4 border-r border-black">
<div class="bg-zinc-100 p-2 font-mono text-[10px] leading-tight border-l-2 border-black">
                                        INFRA_FIT: TERRAFORM, AWS.<br/>
                                        SENIORITY: VERIFIED_MATCH<br/>
                                        BENE_LEVEL: TIER_1
                                    </div>
</td>
<td class="p-4">
<div class="flex justify-center gap-2 font-['JetBrains_Mono'] text-[10px] font-bold">
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[VIEW]</button>
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[POST]</button>
<button class="px-2 py-1 border border-black hover:bg-tertiary hover:text-white">[DISCARD]</button>
</div>
</td>
</tr>
<!-- Row 3 -->
<tr class="border-b border-black hover:bg-zinc-50 transition-colors">
<td class="p-4 border-r border-black font-['JetBrains_Mono'] font-bold text-lg text-black opacity-60">82.1</td>
<td class="p-4 border-r border-black font-medium uppercase text-sm">Product Strategist</td>
<td class="p-4 border-r border-black font-mono text-sm">VOID_DYNAMICS</td>
<td class="p-4 border-r border-black text-xs opacity-70">New York, NY</td>
<td class="p-4 border-r border-black">
<div class="bg-zinc-100 p-2 font-mono text-[10px] leading-tight border-l-2 border-black">
                                        DOMAIN: FINTECH_ADJACENT<br/>
                                        SKILL_GAP: MARKET_ANALYSIS<br/>
                                        PRIORITY: LOW_URGENCY
                                    </div>
</td>
<td class="p-4">
<div class="flex justify-center gap-2 font-['JetBrains_Mono'] text-[10px] font-bold">
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[VIEW]</button>
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[POST]</button>
<button class="px-2 py-1 border border-black hover:bg-tertiary hover:text-white">[DISCARD]</button>
</div>
</td>
</tr>
<!-- Row 4 -->
<tr class="border-b border-black hover:bg-zinc-50 transition-colors">
<td class="p-4 border-r border-black font-['JetBrains_Mono'] font-bold text-lg text-secondary">91.4</td>
<td class="p-4 border-r border-black font-medium uppercase text-sm">Backend Developer (Core)</td>
<td class="p-4 border-r border-black font-mono text-sm">SYNTHETIC_LABS</td>
<td class="p-4 border-r border-black text-xs opacity-70">Berlin, DE</td>
<td class="p-4 border-r border-black">
<div class="bg-zinc-100 p-2 font-mono text-[10px] leading-tight border-l-2 border-black">
                                        CORE_FIT: GO, POSTGRES.<br/>
                                        TEAM_STRUCT: HYBRID<br/>
                                        NOTES: FAST_TRACK_AVAIL
                                    </div>
</td>
<td class="p-4">
<div class="flex justify-center gap-2 font-['JetBrains_Mono'] text-[10px] font-bold">
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[VIEW]</button>
<button class="px-2 py-1 border border-black hover:bg-black hover:text-white">[POST]</button>
<button class="px-2 py-1 border border-black hover:bg-tertiary hover:text-white">[DISCARD]</button>
</div>
</td>
</tr>
</tbody>
</table>
<!-- Paginator -->
<div class="flex justify-between items-center p-4 bg-zinc-50 font-['JetBrains_Mono'] text-xs border-t-2 border-black">
<div class="opacity-50 uppercase tracking-widest">Showing: 001 - 004 / Total: 342</div>
<div class="flex items-center gap-4">
<button class="px-3 py-1 border border-black opacity-30 cursor-not-allowed">[ &lt; ]</button>
<span class="font-bold">01 / 15</span>
<button class="px-3 py-1 border border-black hover:bg-black hover:text-white">[ &gt; ]</button>
</div>
</div>
</div>
<!-- High Density Visual Meta -->
<div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
<div class="border border-black p-4">
<div class="font-bold font-['Space_Grotesk'] text-[10px] uppercase opacity-50 mb-4 tracking-widest">Market_Flow_Visualization</div>
<div class="h-32 bg-zinc-100 border-l border-b border-black relative overflow-hidden">
<!-- Simulated Chart -->
<div class="absolute bottom-0 w-full flex items-end justify-between px-2 h-full">
<div class="w-2 bg-black h-12"></div>
<div class="w-2 bg-black h-20"></div>
<div class="w-2 bg-black h-16"></div>
<div class="w-2 bg-black h-24"></div>
<div class="w-2 bg-black h-8"></div>
<div class="w-2 bg-black h-28"></div>
<div class="w-2 bg-black h-22"></div>
<div class="w-2 bg-black h-14"></div>
</div>
</div>
</div>
<div class="col-span-2 border border-black p-6 bg-white">
<div class="flex justify-between items-start mb-6">
<div>
<h3 class="font-bold font-['Space_Grotesk'] text-lg uppercase leading-none">Global_Intelligence_Overview</h3>
<p class="text-[10px] font-mono opacity-50 uppercase mt-1">Satellite_Sync: Active // 4_Nodes_Online</p>
</div>
<div class="text-right">
<span class="text-3xl font-bold font-mono">88%</span>
<div class="text-[8px] font-mono uppercase">Confidence_Index</div>
</div>
</div>
<div class="flex gap-4">
<img class="w-20 h-20 grayscale border border-black object-cover" data-alt="high contrast macro photograph of a mechanical typewriter hammer striking a white paper surface in dramatic monochrome lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoI0wUlh3IvA2KyY9ctBBLv6ps8hT0WwTjX1PYgNnBbCyDVbpxwCxih81Ox6ZVAofje8RgLr1fFa3ZTzQ-PW0mtr6eEWXzPzdX0qckqQ3CiW8LlYqdSKcO8zYCe8irTdll3rbGc3ztXwwfK7ReS1JSgZH5BthGoSyMLVxbuqdBHj3-kUJ8gzSmc-CpafBAG4mudllfEx-Bsestjs93RJbTRKKwAleb_0UA1Kwr6bzuHj_ia8WCLPQSDC3YxqstfUWHv86b946kOj6R"/>
<div class="flex-grow font-['Work_Sans'] text-xs leading-relaxed italic opacity-80">
                                "The kinetic nature of the search ensures that no query is static. As the matrix updates, the proximity of your data-fingerprint to prospective nodes fluctuates in real-time. Optimize for high-match clusters in the NE quadrant."
                            </div>
</div>
</div>
</div>
</div>
<!-- Footer (System Stability) -->
<footer class="fixed bottom-0 w-full bg-white dark:bg-black border-t border-black dark:border-white font-['JetBrains_Mono'] text-[10px] uppercase tracking-widest flex justify-between items-center px-6 py-2 shrink-0 z-50">
<div class="flex items-center gap-4">
<span class="font-bold text-black dark:text-white">BUILD_VER_2.0.4 // KINETIC_MANUSCRIPT</span>
<span class="opacity-30">|</span>
<span class="text-emerald-500 font-bold">SYSTEM_STABLE</span>
</div>
<div class="flex gap-6 opacity-60">
<span class="hover:opacity-100 transition-opacity">RETRY_COUNT: 0</span>
<span class="hover:opacity-100 transition-opacity">LATENCY: 14MS</span>
<span class="hover:opacity-100 transition-opacity">SYNC_EPOCH: 4921-A</span>
</div>
</footer>
</main>
</div>
</body></html>