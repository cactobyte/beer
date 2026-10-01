-- "Vodka RB" was replaced by single/double mixer; a single vodka Red Bull is a single mixer (same 1 unit)
UPDATE drinks SET type = 'mixer' WHERE type = 'vodka_redbull';
