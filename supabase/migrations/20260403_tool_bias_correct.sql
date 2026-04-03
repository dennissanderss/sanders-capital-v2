-- Bias tracking: what did each analysis say, and was it correct?
-- fundamental_bias / technical_bias = recorded at entry (bullish/bearish)
-- tool_bias_correct / ta_correct = recorded at close (was it right?)

ALTER TABLE ts_trades ADD COLUMN IF NOT EXISTS fundamental_bias text DEFAULT NULL;
ALTER TABLE ts_trades ADD COLUMN IF NOT EXISTS technical_bias text DEFAULT NULL;
ALTER TABLE ts_trades ADD COLUMN IF NOT EXISTS tool_bias_correct boolean DEFAULT NULL;
ALTER TABLE ts_trades ADD COLUMN IF NOT EXISTS ta_correct boolean DEFAULT NULL;
