$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "Account ID: $ACCOUNT_ID"

$template = Get-Content "$PSScriptRoot\trust-policy-template.json" -Raw
$policy = $template -replace "ACCOUNT_ID", $ACCOUNT_ID
$policy | Out-File -FilePath "$env:TEMP\trust.json" -Encoding ascii -NoNewline

aws iam create-role --role-name GitHubActionsRole --assume-role-policy-document "file://$env:TEMP/trust.json"

aws iam attach-role-policy --role-name GitHubActionsRole --policy-arn arn:aws:iam::aws:policy/AmazonSSMFullAccess
aws iam attach-role-policy --role-name GitHubActionsRole --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name GitHubActionsRole --policy-arn arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess

Write-Host "Role ARN:"
aws iam get-role --role-name GitHubActionsRole --query Role.Arn --output text
