//! The questions that a caller asks the decision model, and the answers that the model gives.

use serde::{Deserialize, Serialize};

/// The default probability that a label needs to be chosen in a task that accepts several labels.
pub const DEFAULT_MULTI_LABEL_THRESHOLD: f32 = 0.5;

/// One label that the model can choose.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct DecisionLabel {
    /// The name of the label, for example `refund_request`.
    pub name: String,
    /// An optional sentence that tells the model what the label means.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// One decision to take about a text: a name, the labels to choose from, and how many labels may be chosen.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DecisionTask {
    /// The name of the decision, for example `intent`.
    pub name: String,
    /// The labels to choose from, in the order that the model reads them.
    pub labels: Vec<DecisionLabel>,
    /// An optional question or instruction that the model reads together with the name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    /// Choose every label above the threshold instead of the single best label.
    #[serde(default)]
    pub multi_label: bool,
    /// The probability that a label needs when `multi_label` is true.
    #[serde(default = "default_threshold")]
    pub threshold: f32,
    /// The largest number of labels to return when `multi_label` is true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_k: Option<usize>,
}

fn default_threshold() -> f32 {
    DEFAULT_MULTI_LABEL_THRESHOLD
}

impl DecisionTask {
    /// Creates a task that chooses one label from a list of label names.
    pub fn new<I, S>(name: impl Into<String>, label_names: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self {
            name: name.into(),
            labels: label_names
                .into_iter()
                .map(|label_name| DecisionLabel {
                    name: label_name.into(),
                    description: None,
                })
                .collect(),
            prompt: None,
            multi_label: false,
            threshold: DEFAULT_MULTI_LABEL_THRESHOLD,
            top_k: None,
        }
    }

    /// Adds a question or instruction that the model reads together with the name of the task.
    pub fn with_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.prompt = Some(prompt.into());
        self
    }

    /// Chooses every label whose probability reaches the threshold.
    pub fn with_multi_label(mut self, threshold: f32) -> Self {
        self.multi_label = true;
        self.threshold = threshold;
        self
    }

    /// Keeps at most this many labels, the most probable first, when several labels may be chosen.
    pub fn with_top_k(mut self, top_k: usize) -> Self {
        self.top_k = Some(top_k);
        self
    }

    /// Sets the description of a label. Labels without a description keep none.
    pub fn with_description(mut self, label_name: &str, description: impl Into<String>) -> Self {
        let description = description.into();
        for label in &mut self.labels {
            if label.name == label_name {
                label.description = Some(description.clone());
            }
        }
        self
    }

    /// Checks that the task can be sent to the model.
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.name.trim().is_empty() {
            anyhow::bail!("A decision task needs a name");
        }
        if self.labels.is_empty() {
            anyhow::bail!("The decision task `{}` needs at least one label", self.name);
        }
        if self.labels.iter().any(|label| label.name.trim().is_empty()) {
            anyhow::bail!(
                "The decision task `{}` has a label with an empty name",
                self.name
            );
        }
        if !(0.0..=1.0).contains(&self.threshold) {
            anyhow::bail!(
                "The threshold of the decision task `{}` must be between 0 and 1",
                self.name
            );
        }
        if self.top_k == Some(0) {
            anyhow::bail!(
                "The top_k of the decision task `{}` must be at least 1",
                self.name
            );
        }
        Ok(())
    }
}

/// The score that the model gives to one label.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LabelScore {
    /// The name of the label.
    pub label: String,
    /// The raw output of the model before the probability is computed.
    pub logit: f32,
    /// The probability of the label: a share among all labels for one choice, a separate chance for several choices.
    pub probability: f32,
}

/// The answer of the model to one task.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TaskDecision {
    /// The name of the task.
    pub task: String,
    /// The chosen labels. One label for a task that chooses one label, and at least one label for the other tasks.
    pub chosen: Vec<LabelScore>,
    /// The score of every label, in the order of the task.
    pub scores: Vec<LabelScore>,
}

impl TaskDecision {
    /// Turns the logits of the labels of a task into the decision of the task.
    ///
    /// A task that chooses one label turns the logits into shares that add up to 1 and chooses the largest share. A
    /// task that chooses several labels turns each logit into its own probability, chooses every label that reaches
    /// the threshold, and chooses the most probable label when no label reaches it. The first of two equal
    /// probabilities wins.
    pub fn from_logits(task: &DecisionTask, logits: &[f32]) -> anyhow::Result<Self> {
        if logits.len() != task.labels.len() {
            anyhow::bail!(
                "The model gave {} logits for the {} labels of the task `{}`",
                logits.len(),
                task.labels.len(),
                task.name
            );
        }
        let probabilities = if task.multi_label {
            logits
                .iter()
                .map(|logit| sigmoid(*logit))
                .collect::<Vec<f32>>()
        } else {
            softmax(logits)
        };
        let scores: Vec<LabelScore> = task
            .labels
            .iter()
            .zip(logits.iter().zip(probabilities.iter()))
            .map(|(label, (logit, probability))| LabelScore {
                label: label.name.clone(),
                logit: *logit,
                probability: *probability,
            })
            .collect();

        let mut best_index = 0;
        for (index, score) in scores.iter().enumerate() {
            if score.probability > scores[best_index].probability {
                best_index = index;
            }
        }

        let chosen = if task.multi_label {
            let mut above_threshold: Vec<LabelScore> = scores
                .iter()
                .filter(|score| score.probability >= task.threshold)
                .cloned()
                .collect();
            if above_threshold.is_empty() {
                above_threshold.push(scores[best_index].clone());
            }
            if let Some(top_k) = task.top_k {
                above_threshold.sort_by(|first, second| {
                    second
                        .probability
                        .partial_cmp(&first.probability)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
                above_threshold.truncate(top_k);
            }
            above_threshold
        } else {
            vec![scores[best_index].clone()]
        };

        Ok(Self {
            task: task.name.clone(),
            chosen,
            scores,
        })
    }
}

fn sigmoid(logit: f32) -> f32 {
    1.0 / (1.0 + (-logit).exp())
}

fn softmax(logits: &[f32]) -> Vec<f32> {
    let largest = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exponentials: Vec<f32> = logits.iter().map(|logit| (logit - largest).exp()).collect();
    let total: f32 = exponentials.iter().sum();
    exponentials
        .iter()
        .map(|exponential| exponential / total)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{DecisionTask, TaskDecision};

    #[test]
    fn a_task_for_one_label_chooses_the_largest_share() {
        let task = DecisionTask::new("intent", ["a", "b", "c"]);
        let decision = TaskDecision::from_logits(&task, &[0.0, 2.0, 1.0]).unwrap();
        assert_eq!(decision.chosen.len(), 1);
        assert_eq!(decision.chosen[0].label, "b");
        let total: f32 = decision.scores.iter().map(|score| score.probability).sum();
        assert!((total - 1.0).abs() < 1e-6);
    }

    #[test]
    fn the_first_of_two_equal_probabilities_wins() {
        let task = DecisionTask::new("intent", ["a", "b"]);
        let decision = TaskDecision::from_logits(&task, &[1.0, 1.0]).unwrap();
        assert_eq!(decision.chosen[0].label, "a");
    }

    #[test]
    fn a_task_for_several_labels_chooses_every_label_above_the_threshold_in_label_order() {
        let task =
            DecisionTask::new("aspects", ["battery", "keyboard", "screen"]).with_multi_label(0.4);
        let decision = TaskDecision::from_logits(&task, &[1.0, -3.0, 4.0]).unwrap();
        let chosen: Vec<&str> = decision
            .chosen
            .iter()
            .map(|score| score.label.as_str())
            .collect();
        assert_eq!(chosen, ["battery", "screen"]);
    }

    #[test]
    fn a_task_for_several_labels_falls_back_to_the_most_probable_label() {
        let task = DecisionTask::new("aspects", ["battery", "keyboard"]).with_multi_label(0.9);
        let decision = TaskDecision::from_logits(&task, &[-1.0, -0.5]).unwrap();
        assert_eq!(decision.chosen.len(), 1);
        assert_eq!(decision.chosen[0].label, "keyboard");
    }

    #[test]
    fn top_k_keeps_the_most_probable_labels_first() {
        let task = DecisionTask::new("aspects", ["a", "b", "c"])
            .with_multi_label(0.1)
            .with_top_k(2);
        let decision = TaskDecision::from_logits(&task, &[1.0, 3.0, 2.0]).unwrap();
        let chosen: Vec<&str> = decision
            .chosen
            .iter()
            .map(|score| score.label.as_str())
            .collect();
        assert_eq!(chosen, ["b", "c"]);
    }

    #[test]
    fn a_wrong_number_of_logits_is_an_error() {
        let task = DecisionTask::new("intent", ["a", "b"]);
        assert!(TaskDecision::from_logits(&task, &[1.0]).is_err());
    }

    #[test]
    fn validation_rejects_an_empty_task() {
        assert!(DecisionTask::new("intent", Vec::<String>::new())
            .validate()
            .is_err());
        assert!(DecisionTask::new("", ["a"]).validate().is_err());
        assert!(DecisionTask::new("intent", ["a"])
            .with_multi_label(1.5)
            .validate()
            .is_err());
        assert!(DecisionTask::new("intent", ["a"])
            .with_top_k(0)
            .validate()
            .is_err());
        assert!(DecisionTask::new("intent", ["a", "b"]).validate().is_ok());
    }
}
