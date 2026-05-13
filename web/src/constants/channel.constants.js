/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const CHANNEL_OPTIONS = [
  { value: 1, color: 'green', label: 'OpenAI' },
  { value: 3, color: 'orange', label: 'Azure OpenAI' },
  { value: 14, color: 'black', label: 'Anthropic Claude' },
  { value: 24, color: 'orange', label: 'Google Gemini' },
  { value: 33, color: 'blue', label: 'AWS Claude' },
  { value: 41, color: 'cyan', label: 'Vertex AI' },
];

// Channel types that support upstream model list fetching in UI.
export const MODEL_FETCHABLE_CHANNEL_TYPES = new Set([1, 14, 24]);

export const MODEL_TABLE_PAGE_SIZE = 10;
