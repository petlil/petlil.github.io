
let R = (a = 1) => Math.random() * a; // random number generator
let L = (x, y) => (x * x + y * y) ** 0.5; // pythagorean hypoteneuse function

let circleRad = 0.5;

let col1; let col2; let col;

let numPoints = 2500;
let points = [];

let circleCentre1 = [-0.4, -0.2];
let circleCentre2 = [0.4, 0.2]

let connectDist = 0.12; // units
let gapSize = 0.01;

function setup() {
  createCanvas(800, 800);
  
  for(i = 0; i < numPoints; i++) {
    points[i] = createVector(R(2) - 1, R(2) - 1);
  }

  // scheme 1
  col1 = color(5, 102, 141);
  col2 = color(2, 128, 144);
  col3 = color(0, 168, 150);
  col4 = color(2, 195, 154);

  // scheme 2
  // col1 = color(51, 30, 54);
  // col2 = color(65, 51, 122);
  // col3 = color(110, 164, 191);
  // col4 = color(194, 239, 235);

  // col1 = color(35, 25, 66);
  // col2 = color(94, 84, 142);
  // col3 = color(159, 134, 192);
  // col4 = color(190, 149, 196);
  col5 = color(102, 206, 214);

  background(col1);
  run();
}

function draw() {
}

function run() {
  for(k = 0; k < numPoints; k++) {
    let p = [points[k].x, points[k].y];

    let d = sdf(p);

    if(d > 0) {
      col = col1;
    }
    else {
      col = col2;
    }

    //drawCircle(p, 10, col);
    stroke(col);

    //sdrawCircle(p, 10, col);
  }

  connectPoints();
}

function drawCircle([x,y], r, col) {
  noStroke();
  fill(col);
  ellipse(map(x, -1, 1, 0, width), map(y, -1, 1, 0, height), r);
}

// check if two points have the same sign
// and draw a line between them if yes
function connectPoints() {
  for(i = 0; i < numPoints; i++) {
    for(j = i + 1; j < numPoints; j++) {
      di = sdf([points[i].x, points[i].y]);
      dj = sdf([points[j].x, points[j].y]);
      distance = dist(points[i].x, points[i].y, points[j].x, points[j].y);
      if(Math.sign(di) == Math.sign(dj)
         && Math.abs(di) > gapSize
         && Math.abs(dj) > gapSize
         && distance < connectDist) {
        drawLine(points[i], points[j], Math.sign(di), distance);
      }
    }
  }
}

function drawLine(vec1, vec2, sign, distance) {
  let col;
  if(sign == 1) col = col2;
  else {
    if(R(1) > 0.8) col = col5;
    else col = col4;
  } 
  strokeWeight(1);
  col.setAlpha(map(distance, 0, connectDist, 255, 0));
  stroke(col);

  v1x = map(vec1.x, -1, 1, 0, width);
  v1y = map(vec1.y, -1, 1, 0, height);
  v2x = map(vec2.x, -1, 1, 0, width);
  v2y = map(vec2.y, -1, 1, 0, height);

  line(v1x, v1y, v2x, v2y);
}

function drawTriangle([x,y], [cx, cy], col, d) {
  noFill();
  stroke(col);
  strokeWeight(1);

  angle = createVector(x, y).heading();

  x = map(x, -1, 1, 0, width);
  y = map(y, -1, 1, 0, height);

  
  push();
  translate(x, y);
  if(d > 0) rotate(HALF_PI + PI + angle);
  else rotate(HALF_PI + angle);

  triangle(0, 0, -3, 5, 3, 5);

  pop();
}

function sdfCircle([x,y], [cx,cy], r) {
  x -= cx;
  y -= cy;
  return L(x, y) - r;
}

function sdfMoon([px,py], d, ra, rb) {
  py = abs(py);
  p = createVector(px, py);
  a = (ra*ra - rb*rb + d*d) / (2.0 * d);
  b = (max(ra*ra - a*a, 0.0)) ** 0.5;
  if(d * (px * b - py * a) > d * d * max(b - py, 0.0)) {
    d1 = p.sub(createVector(a, b));
    return L(d1.x, d1.y);
  }
  d2 = p.sub(createVector(d, 0));
  return max(L(px, py) - ra, -(L(d2.x, d2.y) - rb));

}

function sdfRep(x, r) {
  x /= r;
  x -= Math.floor(x) + 0.5;
  x *= r;
  return x;
}

function sdf([x, y]) {
  c = sdfCircle([x, y], [0.3, 0], 0.4);
  m = sdfMoon([x,y], 0.3, 0.8, 0.7);
  circle1 = sdfCircle([x, y], circleCentre1, circleRad);
  circle2 = sdfCircle([x, y], circleCentre2, circleRad);
  // circle1 = sdfRep(circle1, 0.3);
  // circle2 = sdfRep(circle2, 0.3);
  return min(circle1, circle2);
  return min(c, m);

}


function keyPressed() {
  if(key == 's') {
    saveCanvas('sdf_out', '.png');
  }
}