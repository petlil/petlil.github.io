
const trackKingi = document.getElementById("image-track-sine-lines");
const handleOnDownKingi = e => trackKingi.dataset.mouseDownAt = e.clientX;
const handleOnUpKingi = () => {
  trackKingi.dataset.mouseDownAt = "0";  
  trackKingi.dataset.prevPercentage = trackKingi.dataset.percentage;
}
const handleOnMoveKingi = e => {
  if(trackKingi.dataset.prevPercentage == undefined || trackKingi.dataset.prevPercentage == NaN) trackKingi.dataset.prevPercentage = "0"; trackKingi.dataset.percentage = "0";
  if(trackKingi.dataset.mouseDownAt === "0") return;
  
  const mouseDelta = parseFloat(trackKingi.dataset.mouseDownAt) - e.clientX,
        maxDelta = window.innerWidth / 2;
  
  const percentage = (mouseDelta / maxDelta) * -100,
        nextPercentageUnconstrained = parseFloat(trackKingi.dataset.prevPercentage) + percentage,
        nextPercentage = Math.max(Math.min(nextPercentageUnconstrained, 0), -50);
  trackKingi.dataset.percentage = nextPercentage;

  trackKingi.animate({
    transform: `translate(${nextPercentage}%, -50%)`
  }, { duration: 1200, fill: "forwards" });
  
  var index = 0;
  for(const image of trackKingi.getElementsByClassName("image")) {
    image.animate({
      objectPosition: `${100 + nextPercentage}% center`
    }, { duration: 1200, fill: "forwards" });
    index++;
  }
}

window.onmousedown = e => handleOnDownKingi(e);
window.ontouchstart = e => handleOnDownKingi(e.touches[0]);
window.onmouseup = e => handleOnUpKingi(e);
window.ontouchend = e => handleOnUpKingi(e.touches[0]);
window.onmousemove = e => handleOnMoveKingi(e);
window.ontouchmove = e => handleOnMoveKingi(e.touches[0]);
