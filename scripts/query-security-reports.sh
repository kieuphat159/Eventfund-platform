#!/bin/bash
# Query Security Reports from S3
# Usage: ./scripts/query-security-reports.sh [command] [options]

set -euo pipefail

# Configuration
S3_BUCKET="${S3_BUCKET:-eventfund-security-reports}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
fi

# Check jq
if ! command -v jq &> /dev/null; then
    log_error "jq not found. Install: https://stedolan.github.io/jq/"
    exit 1
fi

# Commands
cmd_list() {
    local tool="${1:-}"
    local branch="${2:-}"

    log_info "Listing security scans..."

    if [ -z "$tool" ]; then
        log_info "Available tools:"
        aws s3 ls "s3://${S3_BUCKET}/" | awk '{print "  - " $2}' | sed 's|/||'
        return
    fi

    local prefix="${tool}/"
    if [ -n "$branch" ]; then
        log_info "Filtering by branch: $branch"
    fi

    echo ""
    echo "Recent scans:"
    echo "─────────────────────────────────────────────────────────────────────────────"
    printf "%-30s %-15s %-10s %-10s\n" "SCAN ID" "BRANCH" "COMMIT" "RUN"
    echo "─────────────────────────────────────────────────────────────────────────────"

    aws s3 ls "s3://${S3_BUCKET}/${prefix}" --recursive | \
        grep "metadata.json" | \
        awk '{print $4}' | \
        while read -r path; do
            # Extract scan ID from path
            scan_id=$(basename "$(dirname "$path")")

            # Parse scan ID components
            timestamp=$(echo "$scan_id" | cut -d'_' -f1)
            branch_name=$(echo "$scan_id" | cut -d'_' -f2)
            commit=$(echo "$scan_id" | cut -d'_' -f3)
            run=$(echo "$scan_id" | cut -d'_' -f4)

            # Filter by branch if specified
            if [ -n "$branch" ] && [ "$branch_name" != "$branch" ]; then
                continue
            fi

            printf "%-30s %-15s %-10s %-10s\n" "$timestamp" "$branch_name" "$commit" "$run"
        done | sort -r | head -20

    echo "─────────────────────────────────────────────────────────────────────────────"
}

cmd_latest() {
    local tool="${1:-owasp-dependency-check}"
    local branch="${2:-main}"

    log_info "Finding latest scan for tool=$tool, branch=$branch..."

    local latest_path=$(aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | \
        grep "metadata.json" | \
        grep "_${branch}_" | \
        sort | \
        tail -1 | \
        awk '{print $4}')

    if [ -z "$latest_path" ]; then
        log_error "No scans found for tool=$tool, branch=$branch"
        exit 1
    fi

    local scan_dir=$(dirname "$latest_path")
    local scan_id=$(basename "$scan_dir")

    log_success "Latest scan: $scan_id"
    echo ""

    # Download and show metadata
    aws s3 cp "s3://${S3_BUCKET}/${latest_path}" - | jq .
}

cmd_download() {
    local scan_id="${1:-}"
    local tool="${2:-owasp-dependency-check}"
    local output_dir="${3:-./security-reports}"

    if [ -z "$scan_id" ]; then
        log_error "Usage: $0 download <scan_id> [tool] [output_dir]"
        exit 1
    fi

    log_info "Searching for scan: $scan_id"

    # Find scan path
    local scan_path=$(aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | \
        grep "$scan_id" | \
        head -1 | \
        awk '{print $4}')

    if [ -z "$scan_path" ]; then
        log_error "Scan not found: $scan_id"
        exit 1
    fi

    local scan_dir=$(dirname "$scan_path")
    local dest="${output_dir}/${scan_id}"

    mkdir -p "$dest"

    log_info "Downloading to: $dest"
    aws s3 sync "s3://${S3_BUCKET}/${scan_dir}/" "$dest/"

    log_success "Downloaded successfully!"
    echo ""
    echo "Files:"
    ls -lh "$dest"

    # Open HTML report if exists
    if [ -f "$dest/dependency-check-report.html" ]; then
        log_info "Opening HTML report..."
        if command -v xdg-open &> /dev/null; then
            xdg-open "$dest/dependency-check-report.html"
        elif command -v open &> /dev/null; then
            open "$dest/dependency-check-report.html"
        fi
    elif [ -f "$dest/report.html" ]; then
        log_info "Opening HTML report..."
        if command -v xdg-open &> /dev/null; then
            xdg-open "$dest/report.html"
        elif command -v open &> /dev/null; then
            open "$dest/report.html"
        fi
    fi
}

cmd_compare() {
    local scan1="${1:-}"
    local scan2="${2:-}"
    local tool="${3:-owasp-dependency-check}"

    if [ -z "$scan1" ] || [ -z "$scan2" ]; then
        log_error "Usage: $0 compare <scan_id_1> <scan_id_2> [tool]"
        exit 1
    fi

    log_info "Comparing scans: $scan1 vs $scan2"

    local tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT

    # Download both scans
    cmd_download "$scan1" "$tool" "$tmp_dir" > /dev/null
    cmd_download "$scan2" "$tool" "$tmp_dir" > /dev/null

    # Compare JSON reports
    if [ -f "$tmp_dir/$scan1/dependency-check-report.json" ]; then
        log_info "Comparing OWASP reports..."

        local vuln1=$(cat "$tmp_dir/$scan1/dependency-check-report.json" | jq '[.dependencies[].vulnerabilities[]] | length')
        local vuln2=$(cat "$tmp_dir/$scan2/dependency-check-report.json" | jq '[.dependencies[].vulnerabilities[]] | length')

        echo ""
        echo "Vulnerability Count:"
        echo "  Scan 1 ($scan1): $vuln1"
        echo "  Scan 2 ($scan2): $vuln2"
        echo "  Difference: $((vuln2 - vuln1))"

    elif [ -f "$tmp_dir/$scan1/measures.json" ]; then
        log_info "Comparing SonarQube reports..."

        echo ""
        echo "Metrics Comparison:"
        echo "─────────────────────────────────────────────────────────────"
        printf "%-30s %15s %15s\n" "METRIC" "SCAN 1" "SCAN 2"
        echo "─────────────────────────────────────────────────────────────"

        for metric in bugs vulnerabilities code_smells coverage; do
            local val1=$(cat "$tmp_dir/$scan1/measures.json" | jq -r ".component.measures[] | select(.metric==\"$metric\") | .value // \"N/A\"")
            local val2=$(cat "$tmp_dir/$scan2/measures.json" | jq -r ".component.measures[] | select(.metric==\"$metric\") | .value // \"N/A\"")
            printf "%-30s %15s %15s\n" "$metric" "$val1" "$val2"
        done

        echo "─────────────────────────────────────────────────────────────"
    fi
}

cmd_metadata() {
    local scan_id="${1:-}"
    local tool="${2:-owasp-dependency-check}"

    if [ -z "$scan_id" ]; then
        log_error "Usage: $0 metadata <scan_id> [tool]"
        exit 1
    fi

    log_info "Fetching metadata for: $scan_id"

    local metadata_path=$(aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | \
        grep "$scan_id" | \
        grep "metadata.json" | \
        head -1 | \
        awk '{print $4}')

    if [ -z "$metadata_path" ]; then
        log_error "Metadata not found for scan: $scan_id"
        exit 1
    fi

    aws s3 cp "s3://${S3_BUCKET}/${metadata_path}" - | jq .
}

cmd_stats() {
    local tool="${1:-}"

    log_info "Calculating statistics..."
    echo ""

    if [ -z "$tool" ]; then
        # Overall stats
        echo "Overall Statistics:"
        echo "─────────────────────────────────────────────────────────────"

        for t in owasp-dependency-check sonarqube trivy; do
            local count=$(aws s3 ls "s3://${S3_BUCKET}/${t}/" --recursive | grep "metadata.json" | wc -l)
            printf "%-30s %10s scans\n" "$t" "$count"
        done

        echo "─────────────────────────────────────────────────────────────"

        # Storage size
        echo ""
        echo "Storage Usage:"
        aws s3 ls "s3://${S3_BUCKET}/" --recursive --summarize --human-readable | tail -2

    else
        # Tool-specific stats
        echo "Statistics for: $tool"
        echo "─────────────────────────────────────────────────────────────"

        local total=$(aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | grep "metadata.json" | wc -l)
        echo "Total scans: $total"

        echo ""
        echo "Scans by branch:"
        aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | \
            grep "metadata.json" | \
            awk '{print $4}' | \
            while read -r path; do
                scan_id=$(basename "$(dirname "$path")")
                echo "$scan_id" | cut -d'_' -f2
            done | sort | uniq -c | sort -rn

        echo ""
        echo "Scans by month:"
        aws s3 ls "s3://${S3_BUCKET}/${tool}/" --recursive | \
            grep "metadata.json" | \
            awk '{print $4}' | \
            while read -r path; do
                echo "$path" | cut -d'/' -f2-3
            done | sort | uniq -c | sort -rn

        echo "─────────────────────────────────────────────────────────────"
    fi
}

cmd_help() {
    cat <<EOF
Security Reports Query Tool

Usage: $0 <command> [options]

Commands:
  list [tool] [branch]              List all scans (optionally filter by tool/branch)
  latest <tool> [branch]            Show latest scan metadata
  download <scan_id> [tool] [dir]   Download scan reports
  compare <scan1> <scan2> [tool]    Compare two scans
  metadata <scan_id> [tool]         Show scan metadata
  stats [tool]                      Show statistics
  help                              Show this help

Examples:
  # List all OWASP scans
  $0 list owasp-dependency-check

  # List main branch scans
  $0 list owasp-dependency-check main

  # Get latest scan
  $0 latest owasp-dependency-check main

  # Download specific scan
  $0 download 2026-05-01T10-30-45Z_main_abc1234_run123

  # Compare two scans
  $0 compare scan1_id scan2_id owasp-dependency-check

  # Show statistics
  $0 stats owasp-dependency-check

Environment Variables:
  S3_BUCKET    S3 bucket name (default: eventfund-security-reports)
  AWS_REGION   AWS region (default: ap-southeast-1)

EOF
}

# Main
main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        list)
            cmd_list "$@"
            ;;
        latest)
            cmd_latest "$@"
            ;;
        download)
            cmd_download "$@"
            ;;
        compare)
            cmd_compare "$@"
            ;;
        metadata)
            cmd_metadata "$@"
            ;;
        stats)
            cmd_stats "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
