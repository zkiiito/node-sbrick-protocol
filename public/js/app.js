var sbricks = new SBrickCollection();

var app = new SBrickControllerView({
    el: $('body'),
    sbricks: sbricks
});

Socket.initialize();