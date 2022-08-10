

 /**
 * Konva Image Cropping Plugin.
 *
 * cropTransform - position of the cropped image. x,y,width,height and rotation
 * enableCropOnDblClick - enable enter cropping on dblclick
 * cropEnd - exit cropping
 * cropStart - enter cropping
 */
(function(Konva){
 
/**
 * Decomposes standard 2x2 matrix into transform componentes
 * @static
 * @memberOf geometry
 * @param  {Array} a transformMatrix
 * @return {Object} Components of transform
 */
function qrDecompose(a) {
  let angle = Math.atan2(a[1], a[0]),
    denom = Math.pow(a[0], 2) + Math.pow(a[1], 2),
    scaleX = Math.sqrt(denom),
    scaleY = (a[0] * a[3] - a[2] * a [1]) / scaleX;

  return {
    rotation: angle / (Math.PI / 180),
    scaleX: scaleX,
    scaleY: scaleY,
    x: a[4],
    y: a[5]
  };
}

function getGroupCoords(object, group) {
  let mB = object.getAbsoluteTransform().getMatrix();
  let mX = group.getAbsoluteTransform().getMatrix();

  //possible to replace with mB * mX.invert()
  let M = mB[0], N = mB[1], O = mB[2], P = mB[3], R = mB[4], S = mB[5],
    A = mX[0], B = mX[1], C = mX[2], D = mX[3], E = mX[4], F = mX[5],
    AD = A * D,
    BC = B * C,
    G = (C * N - M * D) / (BC - AD),
    H = (A * N - M * B) / (AD - BC),
    I = (C * P - O * D) / (BC - AD),
    J = (A * P - O * B) / (AD - BC),
    K = (C * (S - F) + D * (E - R)) / (BC - AD),
    L = (A * (S - F) + B * (E - R)) / (AD - BC);


  let matrix = [G, H, I, J, K, L],
    options = qrDecompose(matrix);

  return options;
}

/**
 * enable Cropping On DblClick
 */
Konva.Image.prototype.enableCropOnDblClick = function () {
  this.on('dblclick', function (e) {
    this.cropStart();
  });
};

Konva.Image.prototype.setCropTransform = function (value) {
  if(value === false){
    delete this._cropElement;
    return;
  }
  if (!this._cropElement) {
    this._cropElement = new Konva.Shape();
  }
  this._cropElement.setAttrs(value);
  this._cropElement.setAttrs({
    offsetX: 0,
    offsetY: 0
  });
};

Konva.Image.prototype.getCropTransform = function () {
  return this._cropElement && this._cropElement.getAttrs();
};

Konva.Image.prototype.cropTransform = function (value) {
  if (value) {
    this.setCropTransform(value);
  } else {
    return this.getCropTransform();
  }
};

Konva.Image.prototype.cropEnd = function (context) {
  if (this.cropImage) {
    this.transformer.destroy();
    this.cropImageTransformer.destroy();
    this.cropImage.off('dragmove', this.cropUpdateBinded);
    this.cropImage.off('transform', this.cropUpdateBinded);
    this.off('dragmove', this.cropUpdateBinded);
    this.off('transform', this.resizAndCropUpdateBinded);
    this.cropImage.remove();
    delete this.cropImage;
    delete this.transformer;
    delete this.cropImageTransformer;
    this.getLayer().draw();
  }
};

Konva.Image.prototype.cropUpdate = function (context) {
  let options = getGroupCoords(this.cropImage, this);
  this.cropTransform(options);
  this.getLayer().draw();
};

Konva.Image.prototype.resize = function () {
  this.setAttrs({
    scaleX: 1,
    scaleY: 1,
    width: this.width() * this.scaleX(),
    height: this.height() * this.scaleY()
  });
};

Konva.Image.prototype.cropReset = function (context) {
  if (this.cropImage) {
    this.cropEnd();
  }
  this.setCropTransform(false);
  this.getLayer().draw();
};

Konva.Image.prototype.cropStart = function (context) {
  this.getStage().find('Transformer').destroy();

  if (this.cropImage) {
    return;
  }
  if (!this._cropElement) {
    this.cropTransform({
      x: 0,
      y: 0,
      width: this.width(),
      height: this.height(),
      rotation: 0
    })
  }
  let layer = this.getLayer(),
    transform = this.getAbsoluteTransform(),
    transform2 = this._cropElement.getAbsoluteTransform(),
    transform0 = layer.getAbsoluteTransform(),
    options = qrDecompose(transform0.copy().invert().multiply(transform).multiply(transform2).getMatrix());

  this.cropImage = new Konva.Image({
    stroke: this.stroke(),
    strokeWidth: this.strokeWidth(),
    image: this.image(),
    opacity: 0.5,
    draggable: true
  });
  this.cropImage.isCroppingElement = true;
  this.cropImage.setAttrs(options);
  this.cropImage.setAttrs({
    width: this._cropElement.width(),
    height: this._cropElement.height(),
  });

  layer.add(this.cropImage);
  this.cropImageTransformer = new Konva.Transformer({
    borderDash: [5, 5],
    anchorSize: 21,
    anchorCornerRadius: 11
  })
    .attachTo(this.cropImage);

  this.transformer = new Konva.Transformer()
    .attachTo(this);

  layer.add(this.cropImageTransformer, this.transformer);

  this.cropUpdateBinded = this.cropUpdate.bind(this);

  this.resizAndCropUpdateBinded = function () {
    this.resize();
    this.cropUpdate()
  }.bind(this);

  this.resize();
  this.cropUpdate();
  this.cropImage.on('dragmove', this.cropUpdateBinded);
  this.cropImage.on('transform', this.cropUpdateBinded);
  this.on('dragmove', this.cropUpdateBinded);
  this.on('transform', this.resizAndCropUpdateBinded);

  this.getStage().on('click tap', (e) => {
    if (e.target !== this.cropImage && e.target !== this) {
      this.cropEnd()
    }
  });
  layer.draw();
};

Konva.Image.prototype._sceneFunc = function (context) {
  let width = this.width(),
    height = this.height(),
    image = this.image(),
    cropWidth,
    cropHeight,
    params;

  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.closePath();
  context.clip();
  if (this.hasFill() || this.hasStroke()) {
    context.fillStrokeShape(this);
  }

  if (image) {

    if (this._cropElement) {
      context.save();
      width = this._cropElement.width();
      height = this._cropElement.height();
      let transform = this._cropElement.getAbsoluteTransform();
      let m = transform.getMatrix();
      context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    }

    cropWidth = this.cropWidth();
    cropHeight = this.cropHeight();
    if (cropWidth && cropHeight) {
      params = [
        image,
        this.cropX(),
        this.cropY(),
        cropWidth,
        cropHeight,
        0,
        0,
        width,
        height
      ];
    } else {
      params = [image, 0, 0, width, height];
    }

    context.drawImage.apply(context, params);

    if (this._cropElement) {
      context.restore(); 
    }
  }
  context.strokeShape(this);
  context.restore();
};
})(Konva)

//Demo
var stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: Math.max(window.innerHeight,800)
});
var src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/P._Legendre_%281.5_Mo%29%2A.png/800px-P._Legendre_%281.5_Mo%29%2A.png';
var transformer;
var layer = new Konva.Layer();
var target;
stage.add(layer);

Konva.Image.fromURL(src, function(konvaImage) {
  konvaImage.setAttrs({
    stroke: 'black',
    strokeWidth: 1,
    y: 100,
    x: 118,
    width: 200,
    height: 125,
    draggable: true,
    cropTransform:  {
      height: 175,
      rotation: 10,
      scaleX: 1.256718546954032,
      scaleY: 1.6075454233616444,
      width: 250,
      x: -23.179330196090106,
      y: -100.75893930126733
    }
  });
  konvaImage.enableCropOnDblClick();
  layer.add(konvaImage);
  layer.draw();
  setTimeout(function(){
    konvaImage.cropStart();
  })
});

Konva.Image.fromURL(src, function(konvaImage) {
  konvaImage.setAttrs({
    y: 50,
    x: 350,
    width: 300,
    height: 250,
    draggable: true
  });
  konvaImage.enableCropOnDblClick();
  layer.add(konvaImage);
  layer.draw();
});

stage.on('click tap', function(e) {
  if(transformer){
    transformer.destroy();
  }
  if (e.target === stage || e.target.isCroppingElement) {
    layer.draw();
    return;
  }
  target = e.target;
  transformer = new Konva.Transformer();
  layer.add(transformer);
  transformer.attachTo(e.target);
  layer.draw();
});
stage.scaleX(2);
stage.scaleY(2);
