UPDATE leads
SET summary = replace(summary, '骨架分', '价值分')
WHERE summary LIKE '%骨架分%';

UPDATE leads
SET published_at = '2026-10-23'
WHERE id = 'lead_seed_sh_ai' AND published_at IS NULL;

UPDATE leads
SET published_at = '2026-09-18'
WHERE id = 'lead_seed_bj_pool' AND published_at IS NULL;
