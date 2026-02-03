<script>
  export let section = false
</script>

<div class='d-flex p-20 pb-10 position-relative wrapper content-visibility-auto' class:mb-150={section}>
  <div class='item load-in d-flex flex-column h-full'>
    <div class='image h-200 w-full rounded skeloader bg-ske'/>
    <div class='row pt-15'>
      <div class='col-7'>
        <div class='h-10 skeloader w-150 bg-ske rounded '/>
      </div>
      <div class='col-5 d-flex flex-column align-items-end'>
        <div class='h-10 skeloader w-100 bg-ske mb-5 rounded'/>
        <div class='h-10 skeloader w-50 bg-ske rounded'/>
      </div>
    </div>
  </div>
</div>

<style>
  .item {
    width: 36rem
  }
  .wrapper {
    height: 28.7rem;
    contain-intrinsic-height: 28.7rem;
  }
  .mb-150 {
    margin-bottom: 15rem !important;
  }
</style>
