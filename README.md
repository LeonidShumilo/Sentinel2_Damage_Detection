# Agricultural Field Damage Detection in Ukraine Using Sentinel-2 Data and Deep Learning

Armed conflicts profoundly disrupt land systems and human well-being, causing loss of life, destruction of infrastructure, and severe environmental degradation. Satellite remote sensing has become an essential tool for assessing these impacts by providing consistent, repeatable observations of conflict-driven cropland abandonment, deforestation, burning, and population displacement across affected regions.

However, mapping fine-scale conflict damage—particularly artillery-related damage to agricultural fields—remains challenging. Very-high-resolution (VHR) imagery can capture detailed surface disturbances, but large-scale and near-real-time monitoring is often prohibitively expensive and constrained by data availability. Open-access medium-resolution platforms such as Sentinel-2 and Landsat provide much better temporal coverage and scalability, but their lower spatial resolution, cloud contamination, and co-registration uncertainties complicate reliable damage detection.

Russia’s ongoing war against Ukraine has caused widespread landscape damage, including cratered agricultural fields and contamination by unexploded ordnance (UXO). Identifying damaged fields is important for post-conflict recovery, demining prioritization, and estimation of war-related agricultural losses.

## Overview

This project presents a deep learning workflow for **field-level damage detection** from paired Sentinel-2 images. The approach uses:

- **10 m Sentinel-2 multispectral imagery**
- **RGB, NIR, and SWIR bands**
- **Cloud cover < 30%**
- **Field boundaries delineated using the Delineate Anything model** (Lavreniuk et al., 2025)

The training dataset was built from **8 manually annotated 10 × 10 km areas** in conflict-affected regions of Ukraine. A field polygon was labeled as **damaged** only when damage occurred **between the two image acquisition dates**.

To reduce class imbalance and increase the diversity of damaged samples, each damage observation was paired with up to **five pre-damage images**.

## Models Evaluated

We evaluated **six deep learning architectures** for field-level damage detection:

1. **CNN**
2. **ConvLSTM**
3. **ConvLSTM with Attention**
4. **ConvMixer**
5. **Window Transformer**
6. **Dual Swin Transformer**

---

## Architectures

### 1. CNN

The CNN model serves as the simplest baseline. It treats the full ten-band input as a single multi-channel image and extracts spatial features through three successive convolutional blocks. Each block consists of:

- 2D convolution  
- batch normalization  
- GELU activation  
- max pooling  

Pooling progressively reduces spatial resolution while increasing the receptive field. The final feature map is aggregated with adaptive average pooling and passed to an MLP classifier.

This architecture does not explicitly model temporal structure or spatial attention. Instead, pre-event and post-event information are processed jointly, and the network must infer damage directly from the stacked spectral input. Its main advantage is computational simplicity and efficient inference, making it a useful baseline. Its main limitation is reduced sensitivity to subtle temporal changes.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/CNN.png" alt="CNN architecture" width="500">
</p>

---

### 2. ConvLSTM

To introduce explicit temporal modeling, the ConvLSTM architecture splits the ten-band input into two sequential five-band images representing the **pre-event** and **post-event** observations. These two timesteps are processed by a convolutional long short-term memory (ConvLSTM) cell, which maintains spatially distributed hidden and cell states throughout the sequence.

The hidden state from the final timestep is further refined by a two-layer convolutional block before global pooling and classification.

The main advantage of this model is its explicit representation of temporal change. Through its gating mechanism, the network can preserve information from the pre-event image while incorporating new information from the post-event image, allowing it to learn a spatially distributed change signal. However, because all convolutions are local and no explicit attention mechanism is applied, large-scale spatial context remains limited.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/ConvLSTM.png" alt="ConvLSTM architecture" width="500">
</p>

---

### 3. ConvLSTM with Attention

This model extends the ConvLSTM architecture by adding a **Convolutional Block Attention Module (CBAM)** between the convolutional refinement stage and the final pooling layer.

CBAM applies:

- **Channel attention**, which recalibrates responses across channels using pooled descriptors and a shared MLP
- **Spatial attention**, which highlights informative regions using channel-pooled statistics and a convolutional layer

This addition is especially useful for damage detection, where damage often affects only a limited and spatially irregular part of a field. By emphasizing anomalous regions and suppressing less informative background responses, the attention mechanism improves the discriminative quality of the learned representation.

Compared with the plain ConvLSTM, this model preserves the same temporal modeling framework while improving spatial selectivity at relatively low computational cost. Its limitation is that contextual reasoning is still constrained by the effective receptive field of the convolutional backbone.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/ConvLSTMAtt.png" alt="ConvLSTM with Attention architecture" width="500">
</p>

---

### 4. ConvMixer

The ConvMixer model replaces recurrent processing with a patch-based convolutional token-mixing strategy. A **4 × 4 strided convolution** first projects the ten-band input into a latent feature space with 128 channels. This representation is then processed by **eight ConvMixer blocks**, each combining:

- depthwise convolution for spatial mixing  
- pointwise 1 × 1 convolution for channel mixing  
- residual connections  

Compared with the previous models, ConvMixer provides a deeper and more structured separation between spatial and channel processing, which can improve training stability and parameter efficiency. However, temporal change is not modeled explicitly, since all ten bands are processed jointly in a single stream. Likewise, the model does not include a dedicated attention mechanism, relying instead on progressively enlarged receptive fields and masked global pooling.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/ConvMixer.png" alt="ConvMixer architecture" width="500">
</p>

---

### 5. Window Transformer

The Window Transformer introduces explicit self-attention-based contextual modeling through a **shifted-window attention mechanism** inspired by Swin Transformers. The input image is first converted into patch tokens through a patch embedding layer, after which the token sequence is processed by **twelve Swin blocks**.

These blocks alternate between:

- regular window partitioning  
- cyclically shifted windows  

This design allows information exchange across neighboring windows and progressively expands the effective receptive field.

The main strength of this architecture is its ability to capture longer-range spatial dependencies, which is useful when distinguishing local damage signatures from surrounding undamaged vegetation or background patterns. However, temporal information remains implicit because pre-event and post-event bands are embedded jointly rather than processed as separate streams.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/WindowAtt.png" alt="Window Transformer architecture" width="500">
</p>

---

### 6. Dual Swin Transformer

The Dual Swin Transformer extends the Window Transformer by introducing explicit **dual-stream processing** of pre-event and post-event imagery. The two five-band inputs are embedded separately using independent patch embedding layers, producing reference (**R**) and damage (**D**) token representations.

These two streams are fused using a four-way interaction that combines:

- **D**
- **R**
- **|D − R|**
- **D ⊙ R**

The fused features are then linearly projected and passed through a GELU activation before being processed by **twelve Swin blocks** with alternating shifted windows. After the final normalization layer, masked global average pooling produces a fixed-length representation for classification.

Among the evaluated models, this architecture provides the most complete integration of:

- explicit temporal modeling  
- adaptive spatial weighting through self-attention  
- broad contextual reasoning across the field  

Its main disadvantages are higher computational cost and the requirement for accurately co-registered pre-event and post-event imagery.

<p align="center">
  <img src="https://github.com/LeonidShumilo/Sentinel2_Damage_Detection/blob/main/images/DualSwinTransf.png" alt="Dual Swin Transformer architecture" width="500">
</p>

---

## Key Features

- Field-level agricultural damage detection
- Paired Sentinel-2 image analysis
- Explicit comparison of convolutional, recurrent, and transformer-based models
- Scalable approach using open-access satellite data
- Application to conflict-related environmental monitoring in Ukraine

## Study Area and Data

- **Region:** Conflict-affected agricultural areas of Ukraine  
- **Satellite data:** Sentinel-2  
- **Spatial resolution:** 10 m  
- **Bands used:** RGB, NIR, SWIR  
- **Cloud cover threshold:** <30%  
- **Labels:** Manually annotated field polygons from 8 sample areas  

## Potential Applications

- Post-conflict agricultural recovery
- UXO and demining prioritization
- Damage and loss assessment
- Large-scale operational monitoring of war impacts on cropland

## Validation

Model performance was evaluated using standard classification metrics derived from the confusion matrix at the **field level**. For binary classification, we define:

- **TP** — damaged fields correctly classified as damaged  
- **TN** — undamaged fields correctly classified as undamaged  
- **FP** — undamaged fields incorrectly classified as damaged  
- **FN** — damaged fields incorrectly classified as undamaged  

### Metrics

**User’s Accuracy (UA)**  
User’s Accuracy corresponds to **precision**, that is, the proportion of fields predicted as damaged that are truly damaged:

`UA = TP / (TP + FP)`

**Producer’s Accuracy (PA)**  
Producer’s Accuracy corresponds to **recall**, that is, the proportion of truly damaged fields that were correctly detected:

`PA = TP / (TP + FN)`

**Overall Accuracy (OA)**  
Overall Accuracy is the proportion of all correctly classified fields:

`OA = (TP + TN) / (TP + TN + FP + FN)`

**Average Accuracy (AA)**  
Average Accuracy is the mean of class-wise accuracies. For binary classification:

`AA = 0.5 * (TP / (TP + FN) + TN / (TN + FP))`

where the first term is the accuracy for the damaged class and the second term is the accuracy for the undamaged class.

**F1 Score**  
The F1 score is the harmonic mean of precision and recall:

`F1 = 2 * (UA * PA) / (UA + PA)`

or equivalently:

`F1 = 2TP / (2TP + FP + FN)`

### Interpretation

In the context of agricultural field damage detection, **UA** indicates how reliable predicted damaged fields are, while **PA** reflects how completely the model identifies truly damaged fields. **OA** provides an overall measure of correctness, **AA** balances performance across both classes, and **F1** summarizes the trade-off between precision and recall in a single metric.

---
## Repository Overview

This repository is organized into modules for data preprocessing, model development, validation, and application. It also includes example datasets to help users understand the input data structure and workflow.

### Data Preprocessing

This stage covers image filtering, downloading, annotation, and preparation of training and validation samples.

#### `GEE_data_processing/`
This folder contains Google Earth Engine (GEE) scripts used for satellite image selection, downloading, and annotation.

- **`Images_filtering_csv_generation.js`** — GEE script for filtering images within the region of interest based on cloud cover and exporting a CSV file with information on image availability.
- **`downloader.js`** — GEE script for downloading satellite imagery.
- **`Gee_anotation.js`** — GEE script for annotation of field polygons based on pairs of satellite images and generation of labeled polygons.

#### `Image_preparation.ipynb`
Notebook for generating training and validation datasets from processed satellite images and annotated shapefiles, including sample augmentation.



### Model Architectures, Training, Validation, and Application

This part of the repository contains notebooks for model training, evaluation, area estimation, and inference on field polygons.

- **`Models_training.ipynb`** — Main notebook containing data generators, deep learning model architectures, and training workflows.
- **`Validation_Metrcis_report.ipynb`** — Notebook for generating validation reports for trained models. It uses the validation data generator and model architectures defined in `Models_training.ipynb`.
- **`Area_Estimation_Validation.ipynb`** — Notebook for evaluating area estimation performance based on trained models. It also uses the validation data generator and model architectures from `Models_training.ipynb`.
- **`Polygons_Classification.ipynb`** — Notebook for field polygon classification using trained models and the architectures defined in `Models_training.ipynb`.

### Data Examples

The `Data/` folder contains example inputs used in the workflow:

- **`Satellite_images/`** — Example of two processed satellite images.
- **`polygons/`** — Example of annotated field polygons.
- **`tr_data_example/`** — Example of generated training data.



### Workflow Summary

The general workflow of the repository is as follows:

1. Filter and download suitable satellite imagery in Google Earth Engine.
2. Annotate agricultural field polygons using paired satellite images in GEE.
3. Prepare training and validation datasets with augmentation.
4. Train deep learning models for field-level damage detection.
5. Evaluate model classification and area estimation performance.
6. Apply trained models to classify new agricultural polygons.

---
## Reference

If you use this repository or build upon this work, please cite the related study once the manuscript is published.
