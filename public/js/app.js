var app = new SBrickControllerView({
    el: $('body')
});

Socket.initialize();
Socket.scan();