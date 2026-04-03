-- Add tool_bias_correct column to ts_trades
-- Tracks whether the Daily Macro Briefing tool's fundamental bias was correct
-- Different from htf_bias_respected (which tracks if the trader FOLLOWED the bias)
ALTER TABLE ts_trades ADD COLUMN IF NOT EXISTS tool_bias_correct boolean DEFAULT NULL;
