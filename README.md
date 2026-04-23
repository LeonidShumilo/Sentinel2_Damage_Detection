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

## Reference

If you use this repository or build upon this work, please cite the related study once the manuscript is published.
