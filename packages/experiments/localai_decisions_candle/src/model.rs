//! The neural network of GLiNER2.5-Decide: a DeBERTa v2 encoder and the small network that scores each label.

use anyhow::{bail, Context, Result};
use candle_core::{Device, Module, Tensor};
use candle_nn::{linear, Linear, VarBuilder};
use candle_transformers::models::debertav2::{Config as EncoderConfig, DebertaV2Model};

/// The encoder, and the network that turns the encoder output at a label marker into one logit for the label.
pub struct DecisionNetwork {
    encoder: DebertaV2Model,
    hidden_layer: Linear,
    output_layer: Linear,
    device: Device,
    max_tokens: usize,
}

impl DecisionNetwork {
    /// Reads the weights of the encoder (names starting with `encoder.`) and of the label scoring network (names
    /// starting with `classifier.`) from the safetensors file behind `variables`.
    pub fn load(variables: VarBuilder, encoder_config: &EncoderConfig) -> Result<Self> {
        let device = variables.device().clone();
        let encoder = DebertaV2Model::load(variables.pp("encoder"), encoder_config)
            .context("Could not load the DeBERTa v2 encoder weights into Candle")?;
        let hidden_layer = linear(
            encoder_config.hidden_size,
            encoder_config.hidden_size * 2,
            variables.pp("classifier.0"),
        )
        .context("Could not load the first layer of the label scoring network")?;
        let output_layer = linear(
            encoder_config.hidden_size * 2,
            1,
            variables.pp("classifier.2"),
        )
        .context("Could not load the last layer of the label scoring network")?;
        Ok(Self {
            encoder,
            hidden_layer,
            output_layer,
            device,
            max_tokens: encoder_config.max_position_embeddings,
        })
    }

    /// The largest number of tokens that one text and its tasks may use together.
    pub fn max_tokens(&self) -> usize {
        self.max_tokens
    }

    /// Runs the encoder once over `input_ids` and returns one logit for each position in `label_positions`, grouped
    /// as `label_positions` is grouped.
    pub fn label_logits(
        &self,
        input_ids: &[u32],
        label_positions: &[Vec<usize>],
    ) -> Result<Vec<Vec<f32>>> {
        if input_ids.len() > self.max_tokens {
            bail!(
                "The text and the tasks use {} tokens, and the model accepts at most {}",
                input_ids.len(),
                self.max_tokens
            );
        }
        let flat_positions: Vec<u32> = label_positions
            .iter()
            .flatten()
            .map(|position| u32::try_from(*position))
            .collect::<std::result::Result<_, _>>()
            .context("A label position does not fit in 32 bits")?;
        if flat_positions.is_empty() {
            return Ok(label_positions.iter().map(|_| Vec::new()).collect());
        }

        let input = Tensor::new(input_ids, &self.device)?.unsqueeze(0)?;
        let hidden_states = self.encoder.forward(&input, None, None)?;
        let positions = Tensor::new(flat_positions.as_slice(), &self.device)?;
        let label_states = hidden_states.squeeze(0)?.index_select(&positions, 0)?;
        let logits = self
            .output_layer
            .forward(&self.hidden_layer.forward(&label_states)?.relu()?)?
            .squeeze(1)?
            .to_vec1::<f32>()?;

        let mut grouped = Vec::with_capacity(label_positions.len());
        let mut start = 0;
        for positions in label_positions {
            grouped.push(logits[start..start + positions.len()].to_vec());
            start += positions.len();
        }
        Ok(grouped)
    }
}
