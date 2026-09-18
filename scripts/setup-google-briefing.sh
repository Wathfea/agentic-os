#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:${HOME}/.local/bin:${PATH}"

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
PROJECT_NUMBER="${GOOGLE_CLOUD_PROJECT_NUMBER:-}"
REDIRECT_URI="http://127.0.0.1:3847/api/briefing/oauth/callback"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_PATH="${REPO_ROOT}/store/agentic.config.json"

if [ -z "$PROJECT_ID" ] || [ -z "$PROJECT_NUMBER" ]; then
  echo "Set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_PROJECT_NUMBER to your own GCP project."
  echo "Example:"
  echo "  GOOGLE_CLOUD_PROJECT=my-project GOOGLE_CLOUD_PROJECT_NUMBER=123456789012 $0"
  exit 1
fi

readonly SCOPES=(
  "https://www.googleapis.com/auth/gmail.readonly"
  "https://www.googleapis.com/auth/gmail.modify"
  "https://www.googleapis.com/auth/gmail.settings.basic"
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
  "https://www.googleapis.com/auth/calendar.events.readonly"
)

echo "==> Agentic OS Google briefing setup"
echo "    Project ID:     ${PROJECT_ID}"
echo "    Project number: ${PROJECT_NUMBER}"
echo "    Redirect URI:   ${REDIRECT_URI}"
echo

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Install with:"
  echo "  brew install --cask google-cloud-sdk"
  exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  echo "==> Sign in to gcloud (browser will open)"
  gcloud auth login
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
echo "==> Active account: ${ACTIVE_ACCOUNT}"

gcloud config set project "${PROJECT_ID}"

echo "==> Enabling Gmail and Calendar APIs"
gcloud services enable gmail.googleapis.com calendar-json.googleapis.com --project="${PROJECT_ID}"

echo
echo "==> APIs enabled."
echo
echo "OAuth client + consent screen must be created in Google Auth Platform (no supported gcloud command for Gmail scopes)."
echo
echo "Open these console pages:"
echo "  Branding:  https://console.cloud.google.com/auth/branding?project=${PROJECT_ID}"
echo "  Scopes:    https://console.cloud.google.com/auth/scopes?project=${PROJECT_ID}"
echo "  Clients:   https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}"
echo
echo "1. Branding"
echo "   - App name: Agentic OS Briefing"
echo "   - User support email: ${ACTIVE_ACCOUNT}"
echo "   - Audience: Internal if available, otherwise External + add ${ACTIVE_ACCOUNT} as test user"
echo
echo "2. Data Access > Add scopes:"
for scope in "${SCOPES[@]}"; do
  echo "   - ${scope}"
done
echo
echo "3. Clients > Create client > Web application"
echo "   - Name: Agentic OS Dashboard"
echo "   - Authorized redirect URI:"
echo "       ${REDIRECT_URI}"
echo
echo "4. Copy the client ID and client secret, then run:"
echo "   ${REPO_ROOT}/scripts/save-google-oauth-credentials.sh"
echo

if command -v open >/dev/null 2>&1; then
  read -r -p "Open Google Auth Platform in browser now? [Y/n] " OPEN_NOW
  OPEN_NOW="${OPEN_NOW:-Y}"
  if [[ "${OPEN_NOW}" =~ ^[Yy]$ ]]; then
    open "https://console.cloud.google.com/auth/branding?project=${PROJECT_ID}"
    sleep 1
    open "https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}"
  fi
fi
