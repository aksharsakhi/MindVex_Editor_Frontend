# Fix catch parameters only
$ErrorActionPreference = "Continue"

$files = @(
    "app/components/@settings/core/ControlPanel.tsx",
    "app/components/@settings/tabs/data/DataTab.tsx",
    "app/components/@settings/tabs/profile/ProfileTab.tsx",
    "app/components/workbench/ChatPanel.tsx",
    "app/components/workbench/Workbench.client.tsx",
    "app/lib/graph/graphClient.ts",
    "app/lib/hooks/useGit.ts",
    "app/components/editor/HoverProvider.tsx",
    "app/components/git/GitHooksClient.tsx",
    "app/components/home/ImportRepoModal.tsx"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        continue
    }
    
    $content = Get-Content $file -Raw
    $originalContent = $content
    
    # Fix catch parameters - be very specific
    $content = $content -replace "catch \(err\) \{", "catch {"
    $content = $content -replace "catch \(e\) \{", "catch {"
    $content = $content -replace "catch \(error\) \{", "catch {"
    
    if ($content -ne $originalContent) {
        Set-Content $file -Value $content -NoNewline
        Write-Host "Fixed: $file"
    }
}

Write-Host "Done fixing catch parameters"
